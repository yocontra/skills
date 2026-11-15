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

PASS if, before it drafts sections or asks the user anything, the process it describes pulls
from the incident's Slack channel or from prior PIRs/RCAs (in the repo or a doc tool), in
addition to the PagerDuty incident the user named.

No command can run here, so gathering steps written out (commands or named tool calls) ahead
of the draft count as gathering first, and a draft that follows with `TBD` placeholders is
expected.

FAIL if the only sources it gathers are the PagerDuty incident itself, or if it drafts without
describing any gathering step first.
