---
name: code-cleanup
description: Whole-codebase audit-and-fix sweep — 12 parallel audit agents (bugs, perf, security, architecture, abstractions, error handling, API surface, concurrency, deps, tests, config, docs) then parallel fixes, forever mode. Current diff only → refine:simplify.
effort: medium
---

$ARGUMENTS

# Cleanup

An audit across up to 12 axes, then triage, then parallel fixes. It finds real, impactful issues and resolves them properly. The axes are bugs, performance, security, architecture, abstractions, error handling, API surface, concurrency, dependencies, testing, configuration, and documentation.

Run conventions shared with the other refine skills (command detection, git and non-git targets, temp dir, fix-mode hygiene, spawning, stopping) are in [shared/run-hygiene.md](../../shared/run-hygiene.md).

## 1. Say what it spends

Open every run, on any path, by telling the user what the sweep costs. One cycle is up to 25 agents (one per axis, 1 triage, up to 12 fix), and each pays a full system prompt plus its own read of the scope. Forever mode repeats that every cycle, so a capped loop is on the order of 250 agent calls. In the same message, offer the knobs below. If the run cannot start (empty or unreachable scope), put this in your final reply next to the plan.

| Knob | Effect |
|---|---|
| `axes` | The audit fleet scales with this array. Trim it first: a docs-only or config-only scope has no concurrency or API surface, and a single module rarely needs architecture or dependencies. |
| `auditEffort` / `fixEffort` | Both default to `medium`, and triage runs at `low`. Try `low` for the audit fleet before you change models. Raise `fixEffort` to `high` for a security or concurrency batch. |
| `auditModel` | The audit agents check code against a fixed checklist, so a cheaper model (for example `sonnet`) rarely misses what the top tier would catch. |
| `fixModel` | The fix agents write the code. Keep the session model for security or concurrency fixes; a cheaper model is fine for docs, config, and test findings. |
| `forever` | Prefer one cycle unless the user asked for the loop. |

## 2. Resolve scope and pick the path

- **Scope:** the user's named paths (collect them with `Glob`), else the project root. In git, pin `worktree` to an absolute path: `--worktree <path>` → enclosing repo of the first scoped file → `git rev-parse --show-toplevel`. Fix agents edit whatever tree they land in, so the pin keeps them in the right one. Outside git, use the named paths, else the current directory (say so in the report), and pass `backupDir: "<RUN_DIR>/backup"`.
- Make the run's temp dir (`mktemp -d`), record the fix-mode baseline, and detect the project's test and lint commands.
- **1–3 files:** run inline. Apply the relevant axis prompts yourself, then triage, then fix. No agents.
- **Teammate, forked worker, or no `Workflow`/`Agent` tool:** run the audit, triage, and fix roles inline, one after another, in this context, with the same prompts. Do not try a spawn first.
- **Otherwise:** run the workflow (step 3). If `Workflow` is unavailable or disabled, use the [prose fallback](references/prose-fallback.md) with `Agent`.

## 3. Workflow path

State the wall-clock before launch: about 8 min per cycle for a whole project, times the cycle cap in forever mode. While it runs, report `elapsed Ns / budget Ns`. The cycle cap and stall detection are the hard stops.

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/code-cleanup/cleanup.js",
  args: {
    ...<${CLAUDE_PLUGIN_ROOT}/skills/code-cleanup/cleanup.config.json, axes trimmed to the scope>,
    scope: { rootDescription: "<root>", files: [...] },
    worktree: "<absolute path, or omit outside git>", backupDir: "<only outside git>",
    auditModel: "<model or omit>", fixModel: "<model or omit>",
    auditEffort: "<effort or omit>", fixEffort: "<effort or omit>",
    forever: { enabled: <bool>, cap: 10 },
    promptsDir: "${CLAUDE_PLUGIN_ROOT}/workflows/code-cleanup/prompts"
  }
})
```

If `${CLAUDE_PLUGIN_ROOT}` does not expand in `scriptPath`, resolve it with `echo` and pass the literal path. Each axis here is a single-pass audit. For an adversarially verified pass on one concern, run `/audit:bugs`, `/audit:performance`, `/audit:security`, or `/refine:freshen-docs` directly.

## 4. Verify and report

After the run, run the detected test and lint commands over the touched files and report the result, or "no command found". Then print:

```
CYCLE: 1
FOUND: N issues (N P0, N P1, ...)
FIXED: N issues
REMAINING: N (requires manual intervention)
GATE: <command>: PASS | FAIL — <summary> | no command found
```

Follow it with the per-issue list. In forever mode, print the cycle breakdown instead (format in the [prose fallback](references/prose-fallback.md#forever-mode-report)). Write a file only to a path the user gave.

## Forever mode

With `--forever` or "keep cleaning until clean", each cycle re-audits the whole scope, not just the last fixes. The run exits on exactly three conditions: a cycle with zero surviving issues, a stall (a cycle with the same findings as the previous one), or the 10-cycle cap. A cycle summary with issues remaining and no stall is a progress report, so start the next cycle. If a fix batch fails twice, stop retrying it and list its issues under `REMAINING`.

## Rules

- Audit agents are read-only. Fixing happens only in the fix phase.
- Fix agents make the minimal change per issue, and no two agents edit the same file.
- If an audit agent fails, record its axis as a coverage gap and continue. If a fix batch fails, re-dispatch it once, then report its issues as unfixed.

## Exit checklist

Keep this list current. A turn that ends while an item is open is a progress report, so continue or name the blocker.

- [ ] The run reached an exit: one cycle done, or in forever mode clean, stalled, or capped.
- [ ] Every workflow run or agent this skill started has returned or been stopped with `TaskStop`.
- [ ] The tree matches the baseline except for the intended fixes: stray untracked files are deleted, and there is no new stash, commit, or branch (see [fix-mode hygiene](../../shared/run-hygiene.md#fix-mode-hygiene)).
- [ ] Test and lint ran, or the report says no command was found.
- [ ] `rm -rf "$RUN_DIR"`. Outside git, keep the backup until the user accepts the fixes, and print its path.
- [ ] The summary is printed. No report file is left in the repo.
