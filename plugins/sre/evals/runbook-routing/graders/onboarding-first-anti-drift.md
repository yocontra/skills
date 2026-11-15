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

PASS if the runbook structure it proposes starts with onboarding context that orients someone
new to the service before it reaches the operational procedures, and it keeps the runbook from
going stale by linking to authoritative sources instead of copying data into it.

FAIL if it offers only a list of commands or alert responses with no onboarding section, or if
it says nothing about keeping the content accurate over time.
