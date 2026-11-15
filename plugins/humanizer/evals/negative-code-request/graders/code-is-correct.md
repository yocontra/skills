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

PASS if it gives a Python function that walks the list once, re-pointing each node's `next`
at the previous node, and returns the last node as the new head.

FAIL if the code is wrong — for example it loses nodes, never returns the new head, or
builds a new list instead of reversing in place.
