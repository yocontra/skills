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

PASS if the process it describes has a distinct verification stage after the edits, whose
job is to catch and undo any edit that changed behavior.

FAIL if it describes only a single editing pass with no such check, or if it treats
"I was careful" as the safeguard.
