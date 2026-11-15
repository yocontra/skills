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

PASS if, before fixing, it checks whether someone already owns the failure — asks the
project's other agents (for example `ListAgents` then `SendMessage`) and searches open PRs —
and says to link the owner's PR and carry on if it is owned, or claim it and then fix it if not.

FAIL if it fixes the unrelated failure straight away without checking ownership, or ignores it
with no ownership check at all.
