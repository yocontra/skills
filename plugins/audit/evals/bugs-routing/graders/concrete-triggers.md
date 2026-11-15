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

PASS if it requires every reported bug to come with a concrete trigger — a specific input,
sequence, or condition that causes the failure — rather than accepting "this could be a
problem" as a finding.

FAIL if findings are described with no such evidence requirement.
