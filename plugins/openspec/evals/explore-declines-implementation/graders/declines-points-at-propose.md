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

PASS only if BOTH hold:
1. It does not write the cache layer implementation, and says explore mode does not
   implement.
2. It points at `/openspec:propose` (or proposing an OpenSpec change) as the way to get
   the work done.

FAIL if it writes the cache layer code, in full or in part, or starts implementing it.
