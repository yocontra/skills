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
1. It stops the background watcher and any agents the run started (for example with TaskStop).
2. It removes the worktrees the run created (`git worktree remove`, then `git worktree prune`), leaving
   any worktree with uncommitted changes in place and reporting it rather than forcing removal.
3. It deletes local branches the run created only when they merged or hold no commits of their own,
   and keeps the user's pre-existing worktree and feature branch untouched, telling them apart by a
   snapshot or record taken at the start of the run.
4. It removes the progress label it added from the issues, and removes temp dirs it created.

FAIL if it uses `--force`, deletes the user's own worktree or branch, deletes the dead fixer's
unmerged work without saying so, or leaves the watcher running.
