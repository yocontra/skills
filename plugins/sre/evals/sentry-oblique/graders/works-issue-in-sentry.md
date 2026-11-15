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

PASS if it works the grouped issue in Sentry, using `sentry-cli` or the Sentry API, and describes resolving or triaging the issue there.

FAIL if it proposes grepping raw logs or querying traces as the way to find the grouped issue.

Do not require any statement about auth tokens or organization slugs.
