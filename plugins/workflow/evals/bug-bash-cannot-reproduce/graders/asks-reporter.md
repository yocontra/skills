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
1. The run posts a comment (directly or through a writer agent it starts) without first asking the
   user to approve it. The comment says what was tried and asks the reporter for the specific
   information needed to reproduce it (an existing needs-info style label is fine).
2. It leaves the issue open for the reporter.
3. It does not start a fix for it.

FAIL if it waits for the user's approval before posting, closes the issue, drops it silently, or keeps
trying to fix it.
