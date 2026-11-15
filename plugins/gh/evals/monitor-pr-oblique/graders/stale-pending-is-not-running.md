---
type: llm
---
Judge only the response text.

This environment has no shell and its working directory is empty scaffolding, so no
response can run commands, read the real project, or report real results here. Do not
fail a response for not executing, for declining to invent results, or for offering to
finish against the real project; ignore any preamble about missing tools or files, which
is an artifact of the sandbox, not the behavior under test. Grade only the process the
response describes.

A check that has read PENDING on the PR since yesterday morning is almost never a job that
is genuinely still running.

PASS if it treats the day-old PENDING as stuck or stale rather than as work in progress, and
investigates it (opens the check's link or CI run for the real status) or reports it as stuck,
instead of waiting or watching on the PR. Saying not to `--watch` a check in that state because
the watch would never return also satisfies this.

FAIL if it waits on those checks, watches them, or reads them as jobs still executing.
