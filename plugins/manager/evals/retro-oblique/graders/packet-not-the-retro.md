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

PASS if it assembles a categorized, time-ordered record of what went wrong in the window
— incidents, regressions, reverted PRs, rolled-back deploys — and presents it as material
for the team to work through in their own meeting.

FAIL if it runs the retro itself by writing the conclusions, lessons, and action items on
the team's behalf, or if it produces a weekly status digest or an accomplishments
narrative instead of a what-went-wrong record.

There is no real incident data here, so per-entry impact and severity cannot be filled in.
Do not require them. Proposing a discussion structure or an agenda for the meeting is
fine and does not count as writing the lessons.
