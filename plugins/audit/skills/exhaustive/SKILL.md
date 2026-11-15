---
name: exhaustive
description: Check every item in a named set one by one — every file, endpoint, or row — with partitioned parallel agents and a coverage proof. No sampling. For bug, perf, or security hunts use the other audit skills.
effort: high
---

# Exhaustive search

This skill sweeps an entire search space. Every item is checked individually, and the report proves it with count in = count out. No sampling, no shortcuts.

Start with one line: "Using exhaustive search to sweep <the search space>."

**Use it when** every item in an enumerable set must be inspected (every file, endpoint, log entry, or query row) and a spot check is not acceptable.

**Do not use it when** one grep or glob answers the question, a sample is enough, or the set cannot be enumerated. Do not use it to hunt for bugs, performance problems, or vulnerabilities. The sibling skills `/audit:bugs`, `/audit:performance`, and `/audit:security` do that with their own adversarial pipelines.

## Phase 0: Scope and enumerate

1. **Define the universe.** Be exact, for example "every `.ts` file under `src/`" or "every commit since 2026-04-01". Ambiguity here becomes missed items later.
2. **Enumerate it** into a list of item ids: paths, ids, or `file:line` refs. Use whatever fits the repo and its tools, for example `git ls-files 'src/**/*.ts'` in a git repo, `find src -name '*.ts' -type f` outside one, `git log --format=%H --since=2026-04-01`, or a query's id column. When the list is too long to keep in context, write it to a temp dir that you make for this run: `RUN_DIR=$(mktemp -d "${TMPDIR:-/tmp}/exhaustive.XXXXXX")`, then `... > "$RUN_DIR/items.txt"`. Never write it into the project.
3. **Count it**, for example `wc -l < "$RUN_DIR/items.txt"`, and state "Search space: N items." This count is the ground truth.
4. **Choose the scale:**

| Items | Action |
|---|---|
| Under ~25 | **Inline.** Check each item yourself against the criteria, tick it off the list, and write the same report. 0 agents. |
| 25–500 | Workflow or prose sweep, 25 items per agent |
| 500–5,000 | Same, in waves. Consider a coarse pass that marks areas of interest, then a fine pass over everything. |
| 5,000+ | Say in the launch note: "Search space is large (N items). This needs many agent waves and significant time." Then launch on the full set without waiting. Reduce the scope only when the user asked for a smaller scope, and list exactly what was excluded. |

Never skip an item silently. Any reduction in scope needs the user's request and goes into the report.

## Budget and cost

Before you launch, state the budget: about 4 min per wave × ⌈N / (25 × 10)⌉ waves, plus verification. While the sweep runs, report `elapsed Ns / budget Ns`. The budget is advisory and never justifies dropping items. A run past its budget still finishes every wave.

When the user asks to stop early or call the sweep done because the budget ran out, answer that it is not done: the remaining waves still run, and reconcile must show items checked = N before there is a final report. Recommend that you continue. A question such as "can we call it done?" is not approval to drop items. Only an explicit instruction to skip named items reduces scope, and then the report says INCOMPLETE and lists them.

Each 25 items costs one agent, plus one verifier. At 4 or more agents, the sweep fleet is most of the bill. Lower its effort first (`effort: { sweep: "low" }`) for simple criteria. Then consider a cheaper model (`model: { sweep: "sonnet" }`), which forfeits prompt-cache sharing with this session. Keep the verifier at `high`.

## Run the sweep

**Workflow path** (when the `Workflow` tool is available). It enforces count in = count out as a hard assertion, sweeps in waves of up to 10 agents, and re-sweeps gaps by set difference:

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/exhaustive/sweep.js",
  args: {
    universe: { items: [<every item id>], description: "<what the space is>" },
    criteria: "<exactly what to check each item for>",
    itemKind: "files",           // or "endpoints", "rows", ...
    context: "<optional background for sweep agents>",
    perAgent: 25,
    waveBudgetSec: 240,
    verifyFindings: true
    // optional: maxConcurrent (default 10), effort: { sweep, verify }, model: { sweep, verify }
  }
})
```

If `${CLAUDE_PLUGIN_ROOT}` does not expand inside `scriptPath`, resolve it with `echo "${CLAUDE_PLUGIN_ROOT}"` and pass the literal path. Print the returned coverage report. If it says INCOMPLETE, put that first, and do not claim full coverage.

**Prose path** (no `Workflow` tool):

1. **Partition** the list into non-overlapping groups of about 25 that cover 100% of it. Write out each partition with its item count, and confirm that the counts sum to N. [partitioning.md](references/partitioning.md) lists strategies (directory, alphabetical, numeric range, category, time).
2. **Sweep.** Start one agent per partition, at most 10 at a time, in waves. Each agent gets the body of [sweep-partition.md](../../workflows/exhaustive/prompts/sweep-partition.md), its item list inside `<dataSource:partition>` tags, the criteria, and an `elapsed Ns / budget Ns` line. It returns `processedItemIds` and `findings`. A free-form summary is not acceptable.
3. **Reconcile.** Take the union of the `processedItemIds` and diff it against the Phase 0 list. Re-sweep any missing ids with a targeted agent. Stop after 3 rounds, and list whatever is still missing.
4. **Verify.** Start one verifier with [verify-findings.md](../../workflows/exhaustive/prompts/verify-findings.md), with the merged findings inside `<dataSource:sweep-findings>` tags. Report only the `confirmed` list.

A teammate or a forked worker cannot spawn agents. It runs the prose path inline, partition by partition, with the same reconcile step. The spawning rules (no `name` on `Agent`, the 20-agent session limit) are in [agent-protocol.md](../../shared/agent-protocol.md#agent-contracts).

## Report

Print the report in the conversation, using the template in [partitioning.md](references/partitioning.md#report-template): search space, total, items checked (must equal the total), findings with their item, coverage checks, and a Completeness Declaration. Report negatives too. "Checked 200 files, 3 had issues, 197 clean" is a report. "Found 3 issues" with no coverage figure is not. Write the report to a file only if the user names a path.

## Exit checklist

Use the partition list as the checklist, and mark each partition off as its agent reports. A turn that ends with partitions, re-sweeps, or the verifier still open is a progress report. Launch the next wave. After 2 failed re-sweeps of the same items, stop and list them in the Completeness Declaration.

- [ ] Items checked = the Phase 0 total, or every unchecked item is listed with the reason.
- [ ] No sweep or verifier agent is still running. On abort, stop the workflow run or the remaining agents with `TaskStop`.
- [ ] `rm -rf "$RUN_DIR"` if you made one. The sweep creates no other files. Sweep agents are read-only.
- [ ] The report is printed.

## Rules

1. **Never sample.** If the sweep takes 10 waves, it takes 10 waves.
2. **Never reduce scope silently.** Reduce only on the user's request, and document every exclusion.
3. **Count in, count out**, proved by set difference on the returned ids, not by agents saying they are done.
4. **When in doubt, re-check.** A false negative costs more than a repeated check.
