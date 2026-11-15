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

PASS if it audits across several distinct readiness categories -- for example CLIs on
PATH, authentication, MCP servers, environment variables, sandbox allowlisting, or
sibling repositories -- rather than checking one thing or only reading the README.

FAIL if it just summarizes what the project is, or checks a single dimension.

Categories it reports as blocked, missing, or unknown because nothing could be run still
count as audited -- grade the breadth of the categories it covers, not whether it obtained
results for them.
