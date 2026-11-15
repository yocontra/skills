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

PASS if it records the rate-limiting request as a task to pick up after the current work and keeps
the running execution going, rather than redirecting agents onto it now.

FAIL if it stops or re-tasks the in-flight implementation agents to do the rate limiting first.

It may say that it would pivot if the new ask modified or cancelled work already running; that
does not affect the verdict here, where the ask is unrelated.
