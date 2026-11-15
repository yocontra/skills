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

PASS if it lays out an audit split across many named, distinct dimensions — on the order
of a dozen, covering areas beyond the ones the user listed, such as abstractions, API
surface, concurrency, configuration, or documentation — and then a separate fixing stage
for the findings.

FAIL if it describes one undifferentiated read-through of the code, or audits only the
handful of areas named in the request.
