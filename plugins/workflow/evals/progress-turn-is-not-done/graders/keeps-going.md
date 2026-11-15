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

PASS if it says the run is not finished — tasks 4 and 5 are still open and their implementers are
still running — and that the next step is to wait for them, then carry on through the remaining
steps (review, verification, commit and PR).

FAIL if it treats the status summary as the end of the run, or proposes committing or opening the
PR while the two implementers are still running.
