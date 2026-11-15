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

"Save what I've got in the working tree" covers staged, unstaged and untracked files alike.

PASS if BOTH hold:
1. It inventories all three — including untracked files, not just what `git diff` shows.
2. The files it stages *for the commit* are named explicitly, rather than swept up with
   `git add -A` or `git add .`.

Clause 2 is about the commit. A `git add -A` used only to stage the tree for a pre-commit hook
to run against, and then cleared, is not what this asks about — ignore it.

FAIL if the commit itself is staged with `git add -A` / `git add .`, or if the response only
looks at tracked changes and never accounts for new files.
