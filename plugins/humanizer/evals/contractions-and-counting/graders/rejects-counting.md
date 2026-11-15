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

PASS if it rejects the counts line as a summary and says to describe what the tests cover
and what the endpoints do instead of tallying tests, files, and endpoints.

FAIL if it accepts the counts line as a good summary, or only suggests cosmetic edits to
it such as reformatting or reordering the numbers.
