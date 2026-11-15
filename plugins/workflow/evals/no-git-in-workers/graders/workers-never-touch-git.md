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

PASS if it says the implementation workers must not run git at all — no commits, no
branches, no stash, no rebase — and that every git operation belongs to the orchestrator
once the work is complete.

FAIL if it tells the workers to commit, branch, or push their own work, including as a
safety net against a lost agent.
