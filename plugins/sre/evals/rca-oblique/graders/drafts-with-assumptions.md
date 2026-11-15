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

PASS if it gathers what it can from incident sources first, then drafts the whole document
(impact, timeline, root cause, follow-up actions) in one pass, marking anything it does not
know as `TBD` or an explicit assumption rather than inventing it, and puts its remaining
questions for the user in one batch at the end instead of stopping after each section for
answers.

No command can run and no incident data is reachable here, so a full document skeleton with
every section present, the user's stated facts filled in, and the rest marked `TBD` or as
assumptions counts as the one-pass draft; written-out gathering commands count as gathering.

FAIL if it fabricates incident details (timeline entries, times, or a cause) presented as
fact, if it gates the draft on a section-by-section interview, or if it only points the user
at where PIR status is tracked without authoring the document.
