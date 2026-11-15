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

PASS if it answers with a single search over the project — a grep or equivalent pattern
search for the import — and reports what that search finds.

FAIL if it sets up partitions, waves, or a team of parallel agents for a question one
search answers.
