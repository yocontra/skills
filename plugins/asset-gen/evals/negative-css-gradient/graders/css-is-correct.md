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

PASS if it gives CSS using `linear-gradient` with purple and pink stops for the button
background and a `:hover` rule that lifts the button (for example a `transform:
translateY` with a shadow).

FAIL if there is no gradient, no hover rule, or the CSS would not work.
