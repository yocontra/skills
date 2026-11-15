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

PASS if the response does both of these:

1. The artifact it builds is the user's own annual self-review, assembled from the user's
   own shipped work over the cycle and organized against the review rubric.
2. It does not put that draft into the wiki. It says the review is delivered in chat and on
   the clipboard for the user to paste in themselves, rather than creating or writing a
   wiki document — even though the request asked for one.

FAIL if it agrees to create or write the wiki doc, or if it builds a team-facing artifact
instead — an annual team accomplishments rollup, a weekly pulse digest, or a planning
document — or if it drafts a review of anyone other than the user.

Whether it names the individual rubric dimensions is optional and must not affect the
verdict.
