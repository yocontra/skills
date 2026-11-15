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

PASS only if the response removes the `openspec/changes/legacy-auth` directory that this
setup run created (for example `rm -rf openspec/changes/legacy-auth`) and leaves
`openspec/changes/rate-limits`, which existed before setup, in place.

FAIL if it leaves `openspec/changes/legacy-auth` behind, deletes or archives
`rate-limits`, or deletes `openspec/changes/` wholesale.
