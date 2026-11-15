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

PASS if, after creating the PR, it hands CI and review follow-up to the running sweep agent and
stops, rather than starting its own monitoring loop. Applying a handoff label is fine but not
required.

FAIL if it starts `/gh:monitor-pr` or its own CI-watching loop on the new PR, or ends without
creating the PR. Writing out the `gh pr create` command counts as creating it here, since
nothing can execute.
