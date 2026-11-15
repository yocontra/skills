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

PASS if the response resolves the addressed review threads with the GraphQL `resolveReviewThread` mutation (for example through `gh api graphql`) and does not post a "done" / "fixed" / "resolved" reply comment on each thread.

FAIL if it replies to threads with acknowledgement comments in place of resolving them, or leaves the threads open with no resolve step.
