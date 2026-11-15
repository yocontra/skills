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

PASS if it runs the hunter, skeptic and referee roles inline in its own context, one after
another, with the same prompts and verdict block, and does not try to spawn agents first.

FAIL if it plans to spawn hunter, skeptic or referee agents, asks the lead to spawn them, or drops
the skeptic or referee phase.
