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

PASS only if BOTH hold:
1. It says the standup deliberately leaves pull-request reviews out and does not query them.
2. It gives the reason — the volume of reviews, many of them automated bot pull requests, has
   made a review count meaningless as a measure of work.

FAIL if it agrees to add the review count, or if it queries reviews anyway while noting they
are normally excluded.
