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

PASS if the proof of completeness is that each agent returns the identifiers of the items
it processed, those are summed or set-differenced against the original 3,000, and any gap
is re-swept.

FAIL if completeness rests on the agents saying they finished, on spot-checking a sample,
or on nothing at all.
