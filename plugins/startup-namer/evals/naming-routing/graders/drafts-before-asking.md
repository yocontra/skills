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

PASS if the response proposes a batch of name candidates (around 20) in the same reply,
lists the assumptions it made about things the user did not specify (such as vibe,
audience, or TLD constraints), and puts any follow-up questions at the end rather than
before the names.

FAIL if it opens by asking the user questions and offers no candidate names, or offers
only a handful of names with no assumptions stated.
