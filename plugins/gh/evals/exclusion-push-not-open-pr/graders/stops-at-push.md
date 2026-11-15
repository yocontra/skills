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

The user asked for a commit and a push. They did not ask for a pull request.

PASS if the work ends at the push, and opening the PR is left as a separate step the user can
choose to take next.

FAIL if it runs `gh pr create`, or treats opening the PR as part of finishing this request.

Mentioning that `/gh:open-pr` exists, or offering to run it next, is a PASS — the line is
whether it opens the PR here.
