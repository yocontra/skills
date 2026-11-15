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

PASS if the report it builds covers the whole team over a week-long window and is pitched at a
management audience. The weekly skill's window runs from the previous Wednesday through today, so
a window of fewer than seven days that starts on last Wednesday still counts as week-long.

FAIL if it produces a single-person daily update, a "yesterday / today / blockers" structure, or
anything scoped to one day.
