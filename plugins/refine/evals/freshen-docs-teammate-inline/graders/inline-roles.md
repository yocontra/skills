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

PASS if it runs the finder, skeptic and referee roles itself, inline in its own context,
one after another, reading the code and docs directly, and does not try to spawn agents or
teammates first.

FAIL if it says it cannot read code or make edits itself because it is the orchestrator,
plans to spawn agents or teammates, asks the lead to spawn them, or skips a role.
