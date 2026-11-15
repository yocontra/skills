# Talking points rubric

The skill rises or falls on the 3-5 talking points. Bad output: a
regurgitated list of every PR they touched. Good output: 3-5 things
the manager genuinely should bring up.

A talking point is anything where the manager would benefit from
hearing the report's perspective, or vice versa. Talking points open
conversation — they are not status statements.

| Good (worth bringing up) | Bad (not worth a 1:1) |
|--------------------------|------------------------|
| A PR open for 5+ days with no review activity (asking: are they stuck?) | A PR opened and merged the same day |
| An issue the report marked fixed that is awaiting verification (asking: any signal on whether the fix landed cleanly?) | Routine triage — assigning an issue to themselves |
| Carry-over topic from last week that wasn't resolved | The same topic from three weeks ago that the manager already raised twice |
| An issue / PR involving a sensitive area (security, customer escalation, recently-incident-touching code) | Boilerplate dependency bumps |
| An opportunity surfacing in their work — a chance for them to lead something, mentor someone, present | Routine code review they did |
| A stale action item from a prior 1:1 (older than 14 days) | An action item created two days ago |
| A pattern in their work — a deep dive worth recognizing, OR a hard problem worth supporting | Unrelated single events |

## Heuristics for picking from the artifact pile

**1. Stuck things are always topics.**
- PR with `state == "OPEN"` and `updatedAt < TODAY - 5 days`
- Issue assigned and in progress with no activity in 7 days
- An issue reopened multiple times — a sign
  the fix isn't clean

**2. Carry-over beats novelty.**
- Items from the last 1:1's `Topics` section that weren't resolved in
  the `Notes / decisions` should generally come back this week unless
  the artifact data clearly shows resolution.
- Stale action items (14+ days old, still unchecked) appear as
  topics; see *Stale-item handling* below.

**3. Sensitive-area work is a topic.**
- Anything touching security/identity (`oauth`, `auth`, `mtls`,
  `secrets`).
- Anything in repos that recently had an incident.
- Customer-escalation issues.
- Cross-team PRs (the report is reviewing or being reviewed by people
  outside the team).

These usually deserve at least a "how did that go?" — both for
support and to surface knowledge the manager might not have.

**4. Don't re-litigate the weekly.**
- The weekly status update already covers what shipped.
- 1:1 talking points should focus on what the report needs to talk
  about, not what they've already reported.
- "Congrats on landing X" is not a talking point. The manager can say
  that without skill help.

## Format of each talking point

Each bullet should be a single short line that frames a question or
opens a discussion, not a status statement.

| Good | Bad |
|------|-----|
| `- The billing-service PR has been open 8 days — anything blocking review?` | `- Opened PR #1234 (billing-service)` |
| `- #12345 has been reopened twice — want to talk approach?` | `- Resolved 3 issues` |
| `- Last week we said you'd take the Foo migration; how's that landed?` | `- Old action item: take Foo migration` |
| `- The Bar incident touched code you own; want to walk through what we learned?` | `- Bar incident occurred` |

Keep each bullet to one line: the manager scans the list in five
seconds before walking into the meeting.

## Stale-item handling

For any open action item older than 14 days, generate a talking point
of the form:

```
- Stale: <item> (open since <created date>) — close it, defer it, or
  rework it?
```

Stale items take precedence over new artifact-driven topics. If you
have 3 stale items, they ARE the talking points (with maybe one new
topic). The skill's job here is to refuse to let things rot quietly.

## Edge cases

- **Brand-new report (no prior dated sections).** First 1:1 with a new
  report gets a different shape: introduction-style topics ("how's
  onboarding going? anything blocking your first commit? who have you
  paired with?") rather than artifact-driven ones.
- **Report on PTO during the window.** Detect via no commits + no
  issue transitions + no PR activity for the whole window. Talking
  points should be welcome-back-style ("how was your time off?"), not
  "what did you do" — they did nothing.
- **Heavy week in one area.** If 60%+ of artifacts are in one repo or
  feature, surface it as a "you've been deep on X" framing — invite
  reflection, not just acknowledgment.
- **Cross-team friction signals.** Multiple PR re-review cycles with
  the same external reviewer, or repeated comments rejecting the same
  approach, can indicate friction. Don't accuse, but flag as a topic
  ("there's a back-and-forth on PR Y — anything we should align on?").
