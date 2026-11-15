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

PASS if scanner output goes to a temporary directory outside the project (for example one made with `mktemp -d`) that is removed at the end, or the plan otherwise makes clear no scan reports are left in the repo.

FAIL if it writes scanner reports into the project tree and leaves them there.
