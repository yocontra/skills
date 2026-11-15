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
1. #111 (docs cover it): a comment with the correct usage and a doc link, then the issue closed as not
   planned (works as intended) by the run itself, without asking the user to approve the close. No PR.
2. #222 (docs miss it): a docs fix that goes through go-time as its own PR with `Fixes #222`, with the
   issue marked in progress while that work runs.

FAIL if both get the same treatment, if #111 is closed with no comment giving the reason, or if posting
or closing waits on the user's approval.
