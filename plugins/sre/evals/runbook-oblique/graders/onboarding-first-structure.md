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

PASS if it produces a runbook whose structure leads with what a new on-call person needs
first — orientation, access, and what to do when paged — before deep reference material.

FAIL if it produces only a generic document outline with no on-call orientation, or if it
treats the request as writing a post-incident review.
