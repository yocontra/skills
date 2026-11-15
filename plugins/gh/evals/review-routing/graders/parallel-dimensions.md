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

PASS if BOTH hold:
1. The review is split across several agents working in parallel on distinct named
   dimensions, such as logic, security, performance, error handling, architecture, or
   test coverage.
2. Findings are verified or confidence-scored, and the weak ones dropped, before any
   are shown to the user.

FAIL if it describes one undifferentiated read of the diff, or reports every finding
with no filtering step.
