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

PASS if the response's plan goes from finding the plans in docs/plans/ to converting them
with `openspec new change` without a step that asks the user to confirm the plan list.
Written-out commands count as running them. A note that the real repo or a shell is not
available here, or a checklist marked blocked for that reason, is an environment artifact,
not a gate.

FAIL only if the plan asks the user to confirm or approve the plan list before converting.
