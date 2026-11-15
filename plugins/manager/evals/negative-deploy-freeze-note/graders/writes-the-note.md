---
type: llm
---
This environment has no shell and its working directory is empty scaffolding, so no
response can run commands, read the real project, or report real results here. Do not
fail a response for not executing, for declining to invent results, or for offering to
finish against the real project; ignore any preamble about missing tools or files, which
is an artifact of the sandbox, not the behavior under test. Grade only the process the
response describes.

The response supplies a short Slack message that states the deploy freeze starts Monday
and runs to the end of the month.

PASS if that message is present and says those things. FAIL if no message is written, or
if the answer turns into an interview or a larger manager document — a planning doc, a
weekly digest, a retro packet — instead of the requested note.
