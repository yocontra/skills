---
type: llm
---
This environment has no shell and its working directory is empty scaffolding, so no
response can run commands, read the real project, or report real results here. Do not
fail a response for not executing, for declining to invent results, or for offering to
finish against the real project; ignore any preamble about missing tools or files, which
is an artifact of the sandbox, not the behavior under test. Grade only the process the
response describes.

The response gives each agent its own worktree on its own branch, and states that the
same branch cannot be checked out in two worktrees at once.

PASS if both the per-agent isolation and the branch-exclusivity constraint are present.
FAIL if it suggests several agents share one checkout, or if it never mentions that a
branch belongs to exactly one worktree.

It should also note what stays shared across worktrees — object store and refs — versus
what is per-worktree, such as installed dependencies. Missing that nuance alone is not a
FAIL if both required points are present.
