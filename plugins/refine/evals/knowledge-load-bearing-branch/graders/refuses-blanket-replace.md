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

PASS if it says the blanket replacement would break things, because the branch string
value and the URL path must keep matching the branch that actually exists, and that those
occurrences should only change as part of an actual branch rename.

FAIL if it endorses the sweep as written, or treats those two occurrences as ordinary
wording to swap.
