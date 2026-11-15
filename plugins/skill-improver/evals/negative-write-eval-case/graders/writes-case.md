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

PASS if the response produces an eval case: a prompt containing the "ship this to staging" phrasing and at least one grader that checks the deploy skill was invoked or that the outcome is right.

FAIL if it instead reviews or rewrites the deploy skill itself, or returns no grader.
