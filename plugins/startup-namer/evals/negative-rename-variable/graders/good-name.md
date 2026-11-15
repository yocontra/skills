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

PASS if it suggests a descriptive name for the running sum, such as `total`,
`running_total`, or `total_price`, and shows or describes the rename.

FAIL if it suggests no new name or a name that does not describe a running total.
