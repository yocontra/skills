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

PASS only if ALL hold:
1. It branches the worktree off `develop` (for example `origin/develop`), not `main`.
2. It runs the tests with `just test` (the command the repo names), not a guessed default.
3. It does not require an OpenSpec change for this work.
4. With no CI, it treats the local suites as the gate and says so in the PR, instead of waiting for
   checks that will never run.

FAIL if it bases the work on `main`, uses a different test command, demands an OpenSpec change, or
waits on CI checks.
