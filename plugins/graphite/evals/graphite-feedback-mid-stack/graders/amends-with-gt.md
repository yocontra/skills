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

PASS if the response moves to the second branch with `gt checkout` (or `gt down`), amends the fixes into it with `gt modify`, and gets the branches above updated with `gt restack` or by relying on `gt modify`'s automatic restack, then resubmits with `gt ss` / `gt submit --stack`.

FAIL if it uses `git rebase`, `git pull`, `git merge`, or `git push --force` to update the stack.
