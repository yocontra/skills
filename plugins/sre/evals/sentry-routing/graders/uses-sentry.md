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

PASS if it searches Sentry for the unresolved issue, using `sentry-cli` or the Sentry API,
and gets the stacktrace from the most recent event.

FAIL if it proposes searching raw logs rather than the error tracker.

Do not require any statement about which environment is the default.
