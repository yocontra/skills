# Gaps and the closing questions

The artifacts tell you *what* shipped. Only the user knows what
mattered most, what to leave out, and some live numbers. Draft first
from the artifacts, with a stated default for every gap, then ask
about the gaps in one batch after the draft. Never ask for data you can
pull yourself.

## Defaults while drafting

| Gap | Default, stated in the Assumptions list |
|-----|------------------------------------------|
| Cycle window | From `$ARGUMENTS`; else the last 12 months |
| Rubric | Impact / Execution / Collaboration / Growth from [template.md](template.md) |
| Projects owned vs contributed | Owned: projects where the user authored the design doc or most merged PRs; contributed: the rest |
| Team or role change | Inferred from repo and team changes in the PR history; a manager sub-note only if the user has reports on the GitHub team |
| Headline numbers | Only API-verified counts; a figure the user stated in the request is kept and labeled "confirm this is current" |
| Emphasis | The largest projects by scope and duration lead; the minor-work filter in [verification.md](verification.md) cuts the rest |
| Tone anchor | The user's own design docs found in Step 2; else plain declarative prose |
| Ambiguous category for a project | The category the evidence supports most; note it in Assumptions |
| Manager moments | A `TODO: a hire, an IC growth story, a team norm you set` placeholder; never invented |

## The closing batch

After the draft, one numbered list, most draft-changing first, at most
seven:

- "Is the window right (<start> to <end>), and does your form use
  different categories than <rubric>? Paste the prompts if so."
- "Which projects did you own or lead, if my split is wrong?"
- "Any team, role, or scope change I missed?"
- "What numbers do you want to stand on (users, jobs/day, teams
  onboarded, adoption), and what is the current figure?"
- "Anything that looks big in the commits but you would call minor, or
  small work you are proudest of?"
- "Point me at one or two docs you wrote, so I can match your voice."
- For managers: "Any concrete manager moments for the sub-notes?"

Drop any question the request or the data already answered.

## What not to ask

- Don't ask the user to pick a rating for you to write around; the
  rating is theirs and lives outside the prose.
- Don't ask for anything Step 2 can pull.
