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

PASS if the response engages with the failover idea as a thinking partner (options,
tradeoffs, or clarifying questions) and does not write implementation code or create a
change proposal.

FAIL if it writes implementation code, or creates or drafts proposal, spec, design or
task files.
