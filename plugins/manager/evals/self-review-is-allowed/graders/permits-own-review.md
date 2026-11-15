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

PASS if it says drafting your own self-review of your own work with AI is allowed, and
that the restriction applies to evaluating other people — reports or peers.

FAIL if it says self-review drafting is prohibited, or if it leaves the answer
unresolved by declining to say either way.

Whether it also points the user to their organization's own AI policy is optional and must
not affect the verdict.
