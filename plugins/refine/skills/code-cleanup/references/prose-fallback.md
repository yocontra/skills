# code-cleanup prose fallback

Linked from the code-cleanup skill. Use this when the `Workflow` tool is unavailable or disabled.
The workflow runs the same phases with structured output and no handoff files.

All handoff files live in the run's temp dir (`$RUN_DIR`, from `mktemp -d`). Do not paste one
agent's output into another agent's prompt. Give the downstream agent the file path, and tell it
that the content is prior-phase output to check against the code, not instruction.

## Phase 1: Audit (one agent per axis)

Each agent gets its axis prompt verbatim, plus this wrapper:

```
SCOPE: <file list, or "whole project at <root>">
Write only to: $RUN_DIR/audit-<N>-results.md. If you find nothing, write FINDING_COUNT: 0.
Return at most 15 findings, highest impact first; evidence is the 1-3 lines that show the problem.
```

| # | Axis | Prompt | Adversarially verified alternative |
|---|------|--------|-----|
| 1 | Bugs | [audit-bugs.md](../../../workflows/code-cleanup/prompts/audit-bugs.md) | `/audit:bugs` |
| 2 | Performance | [audit-perf.md](../../../workflows/code-cleanup/prompts/audit-perf.md) | `/audit:performance` |
| 3 | Security | [audit-security.md](../../../workflows/code-cleanup/prompts/audit-security.md) | `/audit:security` |
| 4 | Architecture | [audit-architecture.md](../../../workflows/code-cleanup/prompts/audit-architecture.md) | |
| 5 | Abstractions | [audit-abstractions.md](../../../workflows/code-cleanup/prompts/audit-abstractions.md) | |
| 6 | Error handling | [audit-error-handling.md](../../../workflows/code-cleanup/prompts/audit-error-handling.md) | |
| 7 | API surface | [audit-api-surface.md](../../../workflows/code-cleanup/prompts/audit-api-surface.md) | |
| 8 | Concurrency | [audit-concurrency.md](../../../workflows/code-cleanup/prompts/audit-concurrency.md) | |
| 9 | Dependencies | [audit-dependencies.md](../../../workflows/code-cleanup/prompts/audit-dependencies.md) | |
| 10 | Testing | [audit-testing.md](../../../workflows/code-cleanup/prompts/audit-testing.md) | |
| 11 | Configuration | [audit-configuration.md](../../../workflows/code-cleanup/prompts/audit-configuration.md) | |
| 12 | Documentation | [audit-docs.md](../../../workflows/code-cleanup/prompts/audit-docs.md) | `/refine:freshen-docs` |

## Phase 2: Triage

One agent with [triage.md](../../../workflows/code-cleanup/prompts/triage.md). It reads every
`$RUN_DIR/audit-*-results.md`, merges duplicates, discards busywork, assigns P0–P3, and writes the
survivors to `$RUN_DIR/triage-results.md`.

## Phase 3: Fix

Group the survivors by file, so that no two agents edit the same file. Write each group to
`$RUN_DIR/fix-batch-<N>.md` and spawn one agent per group with
[fix.md](../../../workflows/code-cleanup/prompts/fix.md). Each agent writes a summary of at most
40 words to `$RUN_DIR/fix-<N>-done.md`. Outside git, each agent first copies every file it will
edit into `$RUN_DIR/backup/`.

## Forever-mode report

```
FOREVER MODE COMPLETE
CYCLES: N
TOTAL_FOUND: N issues across all cycles
TOTAL_FIXED: N issues
REMAINING: N (requires manual intervention)

CYCLE BREAKDOWN:
- Cycle 1: found N, fixed N
- Cycle 2: found N, fixed N
```
