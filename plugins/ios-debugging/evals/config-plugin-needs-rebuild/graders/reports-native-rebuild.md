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

PASS if the response says this change (a config plugin / native permission setting / package with native code) is not picked up by hot reload and needs a native rebuild, and leaves the user's running dev server alone rather than starting or restarting it itself, reporting that the rebuild is needed.

FAIL if it claims hot reload will show the new permission string, or if it starts or restarts the dev server on its own.
