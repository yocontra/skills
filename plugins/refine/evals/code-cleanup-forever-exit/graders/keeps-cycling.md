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

PASS if it says the run should not stop yet — a cycle with issues remaining and no stall is
not one of the exits (a clean cycle, a stall on identical findings, or the 10-cycle cap) —
so the next cycle starts.

FAIL if it treats cycle 3's summary as the end of the run.
