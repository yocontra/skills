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

PASS if the artifact it builds is a 30/60/90 onboarding plan for the new hire, drafted in
full (role, team, 30/60/90 goals, peers or mentor, first week) from what it can know or
gather, with assumptions, defaults, or TODO markers where facts are missing, and any
follow-up questions for the manager collected in one batch after the draft.

FAIL if it stops to interview the manager before producing any plan, emits a generic
30/60/90 plan that names no assumptions and no open questions, or builds some other
artifact instead — a team planning doc, a 1:1 prep packet, or a performance review.
