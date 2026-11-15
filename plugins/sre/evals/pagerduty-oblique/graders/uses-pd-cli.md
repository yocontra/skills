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

PASS if it answers both halves from PagerDuty using the `pd` CLI — the on-call schedule, and
the list of incidents that are still triggered or unacknowledged.

FAIL if it proposes reading the roster out of a Slack bot, an incident record system, or a
runbook instead of PagerDuty.
