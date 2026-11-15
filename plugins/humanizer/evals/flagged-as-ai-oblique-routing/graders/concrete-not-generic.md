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

PASS if it points at specific words or constructions in the paragraph (for example "delve",
"pivotal", "evolving landscape", "stands as", or the "not only X, but also Y" shape) and
supplies a rewritten version.

FAIL if the advice stays generic — "be more concise", "add detail", "vary your tone" — with
no specific offender named and no rewrite.
