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

PASS if the response delivers a finished rewritten description.

FAIL if it delivers only an analysis — a pattern-by-pattern breakdown, a numbered audit of
what is wrong, or a list of suggestions — with no rewritten version to post.
