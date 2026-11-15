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

PASS if the response presents one rewritten commit message body as the final version. A
short note on what changed, or a suggestion to add context the user has, is still a PASS.

FAIL if it shows a self-check of its own rewrite (for example "reading it back", "does this
sound like a person wrote it?", a draft followed by a revised second pass), or offers two or
more alternative rewrites for the user to choose from.
