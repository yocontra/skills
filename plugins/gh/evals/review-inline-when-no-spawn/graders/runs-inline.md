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

The caller is a teammate that cannot spawn agents. The review skill then runs the same
phases inline, in sequence, in its own context: each review dimension in turn (for a
52-line diff, two combined passes), then merge and an adversarial verify pass that
re-reads the cited source and drops weak findings, with the usual findings format.

PASS if ALL hold:
1. The review runs in the caller's own context, one dimension or combined pass after
   another, still naming the dimensions it covers.
2. Findings are verified or confidence-scored against the cited source, and weak ones
   dropped, before they are shown.

FAIL if it retries spawning agents, asks the lead to spawn them, skips the review, or
reduces it to one unstructured read with no verification step.
