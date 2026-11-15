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

PASS if ALL hold:
1. It runs the review in its own context with no review agents spawned, because the diff is under
   50 changed lines, while still naming the review dimensions its passes cover.
2. Findings are verified or confidence-scored against the cited source, and weak ones dropped,
   before they are shown.

FAIL if it plans to spawn one or more review or verify agents for this diff, or reduces the review
to one unstructured read with no verification step.
