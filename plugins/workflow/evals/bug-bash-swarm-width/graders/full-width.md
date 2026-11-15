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

PASS only if ALL hold:
1. It starts 20 fixers now, the session's subagent limit, including the first unit of the chain.
   The other ready units start one at a time as running fixers report, and the second unit of the
   chain starts only after the first unit's PR merges.
2. Each fixer opens its PR as soon as its suites and E2E matrix pass, without waiting for other
   fixers.

FAIL if it starts all 29 ready units at once, starts a fixed small number (for example 4 or 5)
well under the limit, or runs both chained units at once.
