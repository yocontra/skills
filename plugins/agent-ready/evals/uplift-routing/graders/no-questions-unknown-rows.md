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

PASS if it commits to a non-interactive, machine-readable report and says that anything it
cannot resolve is recorded with an explicit unknown, missing, or gap status.

FAIL if it asks the user a clarifying question, says it will prompt the user to fill in
missing values, or omits unresolvable items from the report entirely.
