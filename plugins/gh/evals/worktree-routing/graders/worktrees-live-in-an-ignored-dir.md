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

PASS if the worktrees land in one fixed directory inside the repo — `.worktrees/` at the repo
root — and the response deals with git ignoring that directory, either by confirming the
ignore entry is present or by adding it, so the worktree contents do not surface as untracked
changes in the main checkout.

FAIL if the worktree paths are ad-hoc (scattered siblings of the repo, `/tmp`, a different
path per agent chosen on the spot) or if the response puts them inside the repo and never
addresses ignoring them.

Do not require any particular branch naming.
