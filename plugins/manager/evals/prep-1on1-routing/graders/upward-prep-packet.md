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

PASS if the artifact it builds is a prep packet for that one conversation, treated as an
upward meeting: it drafts decisions, asks, and heads-up items from the user's *own* recent
activity, marks what only the user can supply, and batches any questions for the user
after the packet rather than gating the packet on an interview.

FAIL if it builds a different artifact instead — a weekly team digest, a retro packet, an
annual rollup, or a written assessment of the skip or of the user's reports.
