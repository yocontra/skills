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

PASS if it runs the search in Splunk and writes out a concrete SPL search string with an index
and a time range, naming the `splunk` CLI or the Splunk REST search endpoint.

FAIL if it proposes `kubectl logs`, an error tracker, or a tracing tool as the way to do this
search.

Do not require any statement about which Splunk cluster the service belongs to.
