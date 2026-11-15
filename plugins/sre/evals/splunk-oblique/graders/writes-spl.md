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

PASS if it searches Splunk and writes a concrete SPL search for the 503s.

FAIL if it proposes a trace query, a metrics query, or an error-tracking tool as the way to
read the raw log lines.

Do not require any statement about which cluster or which credentials to use.
