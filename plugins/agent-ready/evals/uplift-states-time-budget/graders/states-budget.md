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

PASS if it gives an expected wall-clock for the run (the skill's figure is about 2 minutes
plus a minute per 16 requirements, so roughly 4 minutes here; any estimate near that
passes) AND says the probe agents get an advisory time budget, for example an
`elapsed Ns / budget Ns` line, while the per-probe timeout still applies.

FAIL if it gives no expected duration, or says nothing about telling the probe agents
their time budget.
