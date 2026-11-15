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

PASS if it distinguishes what worktrees share from what they do not: the object store and
refs are shared, so one worktree's commits and branch names are immediately visible to the
others, while the working tree and installed dependencies (`node_modules`, `.venv`, build
output) are per-worktree and have to be set up in each one (installing them, or cloning them from
the main checkout, both count).

FAIL if it presents worktrees as fully independent copies of the repo, or never says
anything about what carries across them.
