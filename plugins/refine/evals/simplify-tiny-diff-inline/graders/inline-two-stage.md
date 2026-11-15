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
1. It runs the simplify pass in its own context with no agents, because the diff is under 50
   changed lines.
2. It still runs a separate behavior-preservation review over every edit, against a snapshot, and
   reverts edits that change behavior.

FAIL if it plans one or more simplifier or reviewer agents for this diff, or skips the
behavior-preservation review.
