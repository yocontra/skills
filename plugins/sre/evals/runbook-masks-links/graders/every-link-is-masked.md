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

PASS if every link in the Quick Links section it produces is a masked markdown link of the
form `[Short Label](url)`, with a descriptive label rather than the URL as the visible text.

FAIL if the section displays bare URLs as the visible link text.

Do not require any particular set of links, and do not require any statement about where the runbook is published.
