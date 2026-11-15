# The six areas of onboard-plan

Draft every area from what Step 1 gathered, then fill what is left
with a stated default or a `TODO(manager):` marker. Each area lists its
sources, its default, and the question that goes into the closing
batch only when the gap is still open. Never ask what a source answers.

The order builds context: role (broadest), team, goals (target state),
peers, buddy and mentor, first week (most concrete).

## 1. The role

**Sources:** `$ARGUMENTS`, the job title if given, the repos and
issues the team works in.

**Default:** a mid-level engineer who works independently on the
team's main repo. State the assumption in Role context.

**Closing questions, if still open:**

- "What specific work was deferred or dropped that this hire will
  pick up?"
- "If they fully succeed in year one, what is the single biggest
  thing they own?"
- "Seniority: junior, mid, senior, or staff and above?" (only if the
  plan would change; it sets how fast 60 and 90 ramp)

## 2. Team context

**Sources:** the roster, the top repos and their READMEs, open
milestones and project boards, recent merged PR themes.

**Default:** summarize the projects in flight from milestones and PR
themes. Mark tribal knowledge as `TODO(manager): what takes a few
weeks to figure out here?`

**Closing questions, if still open:**

- "What is something about the team you wish you could tell them on
  day one?" (push for a specific answer, not "the team is friendly")
- "Is the team heads-down shipping, between projects, or
  firefighting, and how do you want to frame that to them?"

## 3. Goals (30 / 60 / 90)

**Sources:** good-first-issues, the active milestone, the repos the
hire will work in.

**Default:** 30 days: setup plus one merged change from the starter
list. 60 days: owns a small feature or bug area end to end, reviews
teammates' PRs. 90 days: owns a component or leads a slice of the
active milestone. Write each goal as something a third party could
verify (see [house-style.md](house-style.md)). If day 90 reads like
day 60, add what is new at 90 (owning, leading, mentoring).

**Closing question, if still open:** "What does 'fully ramped' mean
in this role at day 90?"

## 4. Peers and partner contacts

**Sources:** the roster; reviewers and co-authors on PRs in the
hire's likely repos; teams that own linked repos or issues.

**Default:** 3–5 team members who are most active in those repos,
each with the reason drawn from the data ("reviews most auth PRs").
Cap the first-two-weeks list at five.

**Closing question, if still open:** "Who outside the team (partner
teams, cross-functional contacts) should they meet in the first 30
days, and why each?"

## 5. Buddy and mentor

**Sources:** the roster and review activity.

**Default:** suggest the most active reviewer in the hire's main repo
as buddy, marked `<suggested — confirm before day 1>`. Mentor: none
unless the request names one; the buddy covers week-one questions.

**Closing question, if still open:** "Is the suggested buddy right,
and do you want a separate mentor for career growth?"

## 6. First week

**Sources:** good-first-issues, `CONTRIBUTING.md`, `docs/`, the
calendar if a calendar tool is connected.

**Default:** day 1 setup and the repo's contributing guide; days 2–5
one starter issue picked from the list, plus 3–5 team-specific docs
(skip company-wide onboarding). List channels, projects, and repos to
request access to, so the hire is not doing discovery alone.

**Closing question, if still open:** "Is access pre-provisioned, or
will they request it themselves?"

## The closing batch

Put every open question in one numbered list at the end of the
output, grouped by area, most plan-changing first. Keep it to the
questions whose answers would change the plan; skip a catch-all
"anything else?".
