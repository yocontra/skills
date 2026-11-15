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

PASS if the approach ties performance findings to the scale or load at which they matter —
input size, row counts, request volume, concurrency — rather than treating any
inefficiency as worth fixing on sight. Committing to that as the method is enough.

FAIL if it plans a hunt for theoretical micro-optimizations with no notion of the load
that makes them matter.

There is no code in this environment to audit, so the response cannot name real hot paths
or real numbers. Do not require concrete measurements, file names, or issue counts; grade
whether scale is part of how it decides what counts as a finding.
