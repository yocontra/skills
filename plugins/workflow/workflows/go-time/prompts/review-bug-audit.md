# Bug Audit (Single-Pass)

Audit the changed code for correctness bugs in a single pass. This is a lightweight check inside the workflow — for full adversarial depth (hunter / skeptic / referee), `/audit:bugs` is run separately.

## Scope

Review **only** the files changed in the working tree. Enumerate the changeset with `git status --porcelain` (or use the `CHANGED_FILES` list the orchestrator provides) — this **includes newly created (untracked) files** that `git diff` alone omits. Inspect modified files with `git diff`; **read newly created files directly** (they won't appear in `git diff`).

## What to look for

- **Logic errors** — wrong operator, off-by-one, inverted condition, miscounted bounds, incorrect default, wrong return type.
- **Race conditions** — shared state without synchronization, check-then-act, time-of-check-to-time-of-use, unsafe iteration during mutation.
- **Edge cases** — empty input, null/undefined, zero, negative, large, unicode, trailing whitespace, duplicate keys, the values that look "obviously fine" but break parsers.
- **Error handling** — uncaught exceptions, swallowed errors, errors that should surface but don't, retries on non-idempotent operations.
- **Resource leaks** — unclosed files, streams, connections, timers, listeners; missing cleanup on the error path.

## Standard

Only report findings with a **concrete trigger** — a specific input, sequence, or state that causes the bug. "Could potentially fail under unusual conditions" is not a finding. "Returns wrong total when input list is empty (line 42)" is a finding.

## Verdict

- `approved: true` only when no real bugs were found. If you have to hedge, you don't have a finding.
- `approved: false` with `issues` as a list of `{file, detail, severity}`. `detail` must include the trigger and the impact.
