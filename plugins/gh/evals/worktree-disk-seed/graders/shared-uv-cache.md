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

FAIL if the response sets `UV_CACHE_DIR` (or any uv cache directory) inside each worktree, or
recommends `uv cache clean`. Otherwise PASS; a response that just runs `uv sync` passes.
