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
1. It stops the background checks watcher it started.
2. It removes the worktree with `git worktree remove` (no `--force`; a worktree with changes is left
   and reported) and runs `git worktree prune`.
3. It deletes the local branch `fix/77-timeout`, after confirming the PR merged, in a way that works after
   a squash merge (for example comparing the local branch head with the PR's head commit before
   `git branch -D`), rather than relying on `git branch -d` alone or deleting blindly.
4. It deletes the temp file or directory it created.
5. It treats the run as done only once this cleanup is finished.

FAIL if it declares the run done at merge with no cleanup, uses `--force`, or touches branches or
files the run did not create.
