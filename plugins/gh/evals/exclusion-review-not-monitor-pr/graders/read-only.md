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

PASS if the whole job is read-only: it inspects the PR and reports findings, and does not
edit files, commit, push, watch CI, or try to get failing checks green.

FAIL if it starts fixing the code, pushes anything, or takes on the PR's CI state as work.

Whether it posts the findings as a GitHub review or reports them in chat does not decide this
grader.
