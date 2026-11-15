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

PASS if it tells the user what this sweep spends — that it runs a large fleet of parallel
agents, and that a run-until-clean loop repeats that fleet per cycle — and offers at least
one way to bound the spend, such as auditing fewer axes, giving the agents a cheaper model,
or doing a single cycle instead of the loop.

FAIL if it starts the sweep with no statement of what it costs and no way to bound it.
