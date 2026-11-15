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

PASS if the response creates the new branch with `gt create` (for example `gt create -am "..."`) and submits with `gt submit --stack` or its alias `gt ss` (or `gt submit` run so that the new branch and the one below are both submitted).

FAIL if it creates the branch with `git checkout -b` / `git switch -c` or opens the PR with `gh pr create`.
