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

PASS if the response produces a GLB through Meshy, either text-to-3D (preview, then refine, then remesh) or image-to-3D, polls the async tasks until they succeed, and checks or reports Meshy credits (balance before, or credits spent after).

FAIL if it outputs a format other than GLB, skips polling, or never mentions credits.
