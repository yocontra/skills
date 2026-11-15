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

PASS if the script creates an async search job, polls it, reads a bounded page of results,
and then cancels or deletes the job it created (for example `DELETE /services/search/v2/jobs/<sid>`
in a `finally` block or after reading results), including on timeout or failure.

FAIL if the job is left behind after the results are read, or if the search has no `index=`
scope or no time bound.
