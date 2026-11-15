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

PR 3312 already exists.

PASS if it works on that PR — fixes the failing checks, fixes what the reviewer raised,
pushes to the same branch, and marks the review thread resolved, without stopping to ask
permission for any of it. A short reply on the thread is allowed but not required.

FAIL if it opens a new PR, pushes to a different branch, or stops to ask the user before
pushing or resolving.

Surfacing the comment back to the user for a human answer, when the reviewer wants an
explanation rather than a code change, is a PASS.
