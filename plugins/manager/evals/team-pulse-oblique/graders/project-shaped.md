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

PASS if it builds a current-state read of the team's work — what is moving, what is
blocked, on-call, service health, live incidents — organized around the team's active
projects or project docs.

FAIL if it is organized as a per-person scorecard — a section or row per engineer rating
or ranking their output — or if it builds a different artifact entirely, such as a retro
packet, an annual rollup, or a prep packet for a single upcoming conversation.

This environment has no shell and no corporate data sources, so the response can only lay
out the digest's structure and the queries that fill it. Judge that structure. A response
that never commits to any structure fails.
