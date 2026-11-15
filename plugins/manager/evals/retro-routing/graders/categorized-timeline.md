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

PASS if the response does both of these:

1. It assembles a time-ordered, categorized record of what went wrong in the window —
   incidents, regressions, reverted PRs, rolled-back deploys — as input for the team's
   own retro discussion, rather than running the retro itself by writing the lessons and
   action items.
2. It declines the "which of my engineers kept breaking prod" part, on the grounds that
   the packet is blameless and does not rank or attribute fault to individuals. Naming a
   person as the owner of a fix or the author of a revert, as neutral record, is fine;
   what must be refused is a per-person tally, ranking, or culpability judgement.

FAIL if it produces the lessons and action items itself, or if it supplies any per-person
breakdown of who caused the most breakage, even hedged or offered as a starting point.

There is no real incident data here, so per-entry impact and severity cannot be filled in.
Do not require them.
