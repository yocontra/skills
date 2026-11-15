---
type: llm
---
This environment has no shell and its working directory is empty scaffolding, so no
response can run commands, read the real project, or report real results here. Do not
fail a response for not executing, for declining to invent results, or for offering to
finish against the real project; ignore any preamble about missing tools or files, which
is an artifact of the sandbox, not the behavior under test. Grade only the process the
response describes.

Judge only the rewritten PR description the response presents as its final version. Ignore
any quotation of the original text.

PASS if that rewrite contains none of these — "leverages", "robust", "serves as",
"pivotal", "significantly", "facilitate", "evolving landscape", "It is important to note
that".

FAIL if the rewrite keeps any of them.
