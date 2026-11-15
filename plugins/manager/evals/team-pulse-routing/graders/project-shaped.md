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

PASS if the digest it produces or describes is organized around the team's active
projects or project docs, with incidents, on-call, and blockers as cross-cutting signals.

FAIL if it is organized as a per-person scorecard — a section or row per engineer rating
or ranking their output — or if it builds a different artifact entirely, such as a retro
packet or an annual rollup.

This environment has no shell and no corporate data sources, so the response can only
lay out the digest's structure and the queries that fill it. Judge that structure. A
response that never commits to any structure fails.
