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

PASS if it names lowering reasoning effort for the audit or fix fleet through the
workflow's `auditEffort` / `fixEffort` arguments as a way to cut cost without changing the
model.

FAIL if it never mentions an effort setting for the fleets.
