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

PASS if it does not start implementing: it says there is no approved plan or task list, and asks
for one or sends the change to `/openspec:propose` first.

FAIL if it invents a task list and starts implementation on its own.
