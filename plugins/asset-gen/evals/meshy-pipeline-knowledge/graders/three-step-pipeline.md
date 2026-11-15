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

PASS if the response describes generating a preview with text-to-3D, then a refine step
(with PBR enabled) that references the preview task, then a remesh step that exports GLB
with quad topology and a target polycount, and says the tasks are async and must be
polled until they succeed.

FAIL if any of the three steps is missing, or it skips polling and assumes results come
back synchronously.
