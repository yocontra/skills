---
name: performance
description: Audit a codebase for performance issues — slow queries, memory leaks, N+1 problems, blocking operations, scalability bottlenecks. Use for perf sweeps or efficiency stress-tests.
effort: high
---

$ARGUMENTS

# Performance audit

This skill hunts for performance problems adversarially. Three roles with opposing goals remove theoretical concerns and keep the real bottlenecks:

| Role | Goal |
|---|---|
| **Hunter** | Report real bottlenecks, each tied to the load that makes it hurt |
| **Skeptic** | Disprove each finding with evidence from the code; let it survive when there is none |
| **Referee** | Read the code independently and decide what goes into the report |

The shared conventions are in [agent-protocol.md](../../shared/agent-protocol.md): path choice, modes, fix-mode safeguards, cost knobs, findings format, and the exit checklist. The agent prompts are in [`workflows/performance/prompts/`](../../workflows/performance/prompts/): [recon](../../workflows/performance/prompts/recon.md), [hunter](../../workflows/performance/prompts/hunter.md), [dedup](../../workflows/performance/prompts/dedup.md), [skeptic](../../workflows/performance/prompts/skeptic.md), [referee](../../workflows/performance/prompts/referee.md), [poc](../../workflows/performance/prompts/poc.md), and [fix](../../workflows/performance/prompts/fix.md).

## What counts

The load decides what counts. A finding is real only when it names the scale at which it hurts (row count, input size, request rate, concurrency) and the code actually sees that scale. An inefficiency with no such load behind it is a micro-optimization, and the audit does not report it. State this rule in any form of answer, including a full run, a plan, or a list of suspects to check first, and tie each suspected issue to its load.

- **Label confidence.** Mark each finding `static-provable` or `needs-runtime-confirmation`. When the project has a profiler or benchmark command, name the command that would confirm a `needs-runtime-confirmation` finding. Do not run it as part of the audit.
- **Read, don't grep.** Hunters read the hot paths in their zone and reason about cost per request or per record.
- **Severity comes from code structure**, for example a query inside a loop over unbounded input, not from guessed numbers.

## Run

1. **Path.** Choose inline, workflow, or prose pipeline from [the table](../../shared/agent-protocol.md#choose-the-path). A target of 1-3 small files runs inline with no agents.
2. **Scope.** If the user named files, a module, or a hot path, collect them with `Glob` and set `scope.constrained: true`. If not, pass the project root and let recon enumerate.
3. **Mode.** The default mode is report-only. For `--fix` or `--forever`, do the [fix-mode safeguards](../../shared/agent-protocol.md#fix-mode-safeguards) first. A performance fix that changes observable behavior is not a fix. Load sketches are opt-in: set `args.pocPhase: true` only when the user asks to see how the confirmed findings scale. They are text in the report, and nothing is run.
4. **Budget and knobs.** State the budget, and set `args.effort` or `args.model` if needed ([Before launch](../../shared/agent-protocol.md#before-launch)).
5. **Launch** (workflow path). Read `${CLAUDE_PLUGIN_ROOT}/skills/performance/audit.config.json`, merge in `scope` and the mode flags, and run:

   ```
   Workflow({
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/performance/audit.js",
     args: { ...<merged config>, promptsDir: "${CLAUDE_PLUGIN_ROOT}/workflows/performance/prompts" }
   })
   ```

   If `${CLAUDE_PLUGIN_ROOT}` does not expand inside `scriptPath`, resolve it with `echo "${CLAUDE_PLUGIN_ROOT}"` and pass the literal path. If the tool is missing or disabled, use the [prose pipeline](../../shared/prose-pipeline.md).
6. **Report.** Print the returned block verbatim. It uses `PERF-NNN` ids and a `CONFIDENCE:` field, for example:

   ```
   - [PERF-001] SEVERITY: High | FILE: api/orders.py:45 | CLASS: N+1 queries | CONFIDENCE: static-provable | TITLE: one query per line item | FIX: prefetch line items in the list query
   ```

7. **Exit checklist.** Work through the [exit checklist](../../shared/agent-protocol.md#exit-checklist) before you finish.

## Done when

The verdict block (`CLEAN` or `ISSUES_FOUND`) is printed, and every item in the exit checklist is closed. In forever mode, the audit is done when a cycle comes back clean, stalls, or reaches 10 cycles. Do not print the verdict while any agent is still running.
