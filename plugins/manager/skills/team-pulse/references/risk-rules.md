# Pulse rules

How team-pulse classifies artifacts into the digest sections. Tune
thresholds in `~/.config/manager-plugin/team-pulse.json` if a team
needs different ones, but ship with these defaults.

## Project pulse — milestone state

Per project doc, parse milestone bullets from the doc body (or the
task list of a tracking issue). A milestone is
any of:

- `- [ ]` / `- [x]` checkbox bullet
- A row in a table whose first column is a name and whose other columns
  hint at status / target / owner
- A bulleted line under a heading like `Q1`, `Q2`, `This quarter`,
  `Milestones`, `Roadmap`, `Plan`

For each milestone, classify against `project-activity` (merged PRs in
the linked repo + closed issues in the linked GitHub milestone, Project, or label, all within the
window) and the project doc itself:

| State | Rule |
|-------|------|
| **Done** (`✅`) | Checkbox is `[x]`, OR the milestone text is struck through, OR an "shipped" / "done" callout exists in the project doc, OR the linked GitHub milestone is closed or has zero open issues. |
| **Moving** (`🟢`) | At least one merged PR or closed issue in the window plausibly tied to the milestone keyword. |
| **Quiet** (`🟡`) | Not done, no related activity in the window. Flag with day-count since last related activity. Surface only when the milestone has a target date `< TODAY + 14 days` OR has been quiet ≥ 14 days. |
| **Blocked** (`🔴`) | The project doc explicitly says blocked / on-hold / waiting on / pending; OR quiet for ≥ 21 days with no target date. Surface the reason verbatim from the project doc when possible. |
| **Uncertain** (`⏳`) | Skill couldn't decide — surface and let the manager judge. Don't drop. |

Linkage heuristic for "plausibly tied": milestone keyword appears in PR
title or body, or the PR/issue is in the project's linked repo /
label AND merged/closed within the window. When in doubt, mark
Uncertain — don't fabricate links.

## Stuck PRs

A PR is *stuck* if any of these hold:

- `state == OPEN` AND `updatedAt < TODAY - 5 days`
- `state == OPEN` AND a review was requested ≥ 3 days ago and no
  review submitted (waiting on reviewers)
- `state == OPEN` AND has a non-author comment requesting changes
  ≥ 5 days ago that hasn't been addressed (waiting on author)
- `state == OPEN` AND has merge conflicts (`mergeable == CONFLICTING`)
  for ≥ 1 day
- `state == OPEN` AND has failing required checks for ≥ 1 day with no
  new pushes since the failure

Pick the most informative reason when multiple apply. Order of
informativeness: `merge conflict` > `failing CI` > `awaiting review` >
`awaiting author` > `inactive`.

PRs in draft state (`isDraft == true`) are never stuck — drafts are
work in progress. Skip them.

PRs the team-pulse owner authored are still listed if stuck (managers
ship code too). Don't filter the manager out of their own pulse.

Stuck PRs are surfaced as **project blockers**, not per-person
scoreboard items. The `@<login>` is for ping convenience only.

**Two age buckets** — a 7-year-old PR is not "stuck", it's abandoned.
Split:

- **Active stuck** (5–90 days since `updatedAt`): real blockers worth
  surfacing weekly. Sort oldest-first.
- **Ancient** (> 90 days): cleanup candidates. Render as a count plus
  ≤ 5 examples; don't pollute the active list. The ask isn't "unblock
  this," it's "close it or revive it."

Tune the 90-day threshold in `team-pulse.json` under
`stuck_pr_ancient_days` if a team's cadence differs.

## Overdue issues

An issue in the team's tracker (GitHub Issues, Jira, Linear) is
*overdue* if any of these hold:

- A due date or milestone date exists AND it is `< TODAY` AND the issue
  is open
- Priority is P1/P2 (or the tracker's equivalent label or field) AND
  open AND `createdAt < TODAY - 30 days`
- The issue is in an in-progress state (or carries an in-progress
  label) AND has no state change or update in ≥ 14 days

`<reason>` for the digest, in priority order:

1. "past target date" if the due date `< TODAY`
2. "open Nd at P<priority>" if priority condition triggers
3. "no activity in Nd" otherwise

Compute N as `(TODAY - createdAt).days` for the priority case and
`(TODAY - lastTransition).days` for the activity case.

## No per-person activity rule

Do not flag quiet team members. Commit cadence per person is
more surveillance than signal — PTO, design weeks, review-heavy work,
and bunched-up commits all show up identically. Genuine engagement
issues surface through stuck PRs, overdue issues, or in 1:1
conversation, not a daily alert.

## On-call

Always show current on-call assignments when an on-call schedule is
configured. Anomalies to flag:

All three are **client-side computed** by walking the upcoming-rotations
list from the paging tool (for PagerDuty, the `/oncalls` endpoint
filtered by schedule). Don't expect a native "find gaps" flag.

- **No coverage**: any 4-hour window in the next 24 hours has no
  assigned engineer.
- **Back-to-back**: an engineer just finished one rotation and is
  immediately starting another (any team member appears in two
  consecutive rotations across schedules with no gap of 7+ days).
- **Long stretch**: an engineer has been on-call for ≥ 14 consecutive
  days. Flag with a `📅 long stretch` indicator.

## Service health

A service is *unhealthy* if any of these hold:

- ≥ 1 open incident (an `incident`-labelled issue or the team's incident tool)
- ≥ 3 failing CI runs (`gh run list --status failure`) on a team repo's
  default branch in the last 24h (a single flake doesn't trigger;
  persistent breakage does)
- An open outage on the team's status page, if it has one

## Active incidents

Cross-cutting urgent signal. Any open incident touching
team-owned services appears, regardless of severity. Severity ordering:
SEV1/P0 > SEV2/P1 > SEV3/P2 > P3.

## Things explicitly NOT flagged

- **PRs in draft state** — drafts are not "stuck."
- **Issues in a verify / QA state** assigned back to the reporter —
  that's the workflow rebound after a fix, not the reporter's work
  item. Use the original fixer (from issue history or the linked PR)
  for any attribution.
- **Closed PRs / closed issues** — the digest is about live state
  (Project pulse uses closed-in-window for milestone progress, but
  doesn't list them as stuck).
- **Old activity that's resolved** — only currently-open issues count.
  A PR that was stuck last week but merged Monday is not in today's
  digest.
- **The manager's own PRs / issues when running their own pulse** —
  unless they're truly stuck. Don't double-count.
- **Done milestones older than 14 days** — already shipped, no need
  to reprint week after week.

## When to extend rules vs. tune thresholds

Tune thresholds in the config file for legitimate cadence differences.
Add a new section only when it's a genuinely new dimension, not a
re-cut of existing data.
