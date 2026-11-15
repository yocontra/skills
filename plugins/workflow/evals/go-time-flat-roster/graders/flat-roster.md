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

Under go-time the roster is flat: only the lead spawns agents, and teammates and forks run
`/gh:review` and `/refine:simplify` inline. A 40-line diff gets `/gh:review` only.

PASS if ALL hold:
1. The teammate still runs the pre-flight review, in its own context, without spawning
   agents.
2. It says only the lead spawns agents; a teammate or fork does not.

FAIL if it retries the spawn, skips the review, or plans for the teammate to spawn
agents another way.
