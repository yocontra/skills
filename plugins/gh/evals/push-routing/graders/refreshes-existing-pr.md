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

PASS if, after pushing, the response checks whether a PR already exists for the branch
and updates that PR's title and description to match the branch's current state.

FAIL if it stops at `git push` and never considers an existing PR, or if it opens a new
PR from here rather than updating an existing one.
