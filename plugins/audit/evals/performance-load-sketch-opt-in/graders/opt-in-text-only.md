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

PASS if it says a sketch of how the finding scales with load is produced only when the user
asks for one, that such a sketch is text (arithmetic from the code, not measured numbers), and
that the audit runs no benchmark or profiler itself; at most it names the command that would
confirm the finding.

FAIL if it says the audit runs a benchmark, load test, or profiler by default, or presents
invented measured timings as results.
