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

The diff is 90 changed lines. The review skill runs a diff of 50 to 149 changed lines as two
combined agents (logic, security, errors and performance; architecture, tests and
conventions) instead of one agent per dimension, because each extra agent re-pays its whole
context for a few lines of change.

PASS if ALL hold:
1. The plan uses one or two review agents for this diff, not seven, while still naming the
   review dimensions those agents cover.
2. Findings are verified or confidence-scored, and weak ones dropped, before they are shown.

FAIL if it plans six or more separate dimension agents for this diff, or if it reduces the
review to one unstructured read with no verification step.
