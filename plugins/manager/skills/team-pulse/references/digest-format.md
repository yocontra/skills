# Digest format

The output is chat-friendly Markdown (Slack, Teams, or similar). Concise
enough to skim in 30 seconds before a team meeting or 1:1s. Sections only appear if they have
content (except Project pulse, which always shows when projects are
configured — that's the lead).

## Section order (top to bottom)

1. Header
2. **Project pulse** (lead — one block per active project)
3. Active incidents (most urgent cross-cutting signal)
4. Stuck PRs (project blockers)
5. Overdue issues (project blockers)
6. Service health (failing CI, etc.)
7. On-call right now
8. Footer (green-vibe / nothing-flagged)

## Header

```
*Team pulse — <YYYY-MM-DD>*
<small one-liner: how many people, mode, project count>
```

Example:

```
*Team pulse — 2026-06-09*
9 reports · weekly mode · 4 active projects
```

## Project pulse

The lead section. One block per active project doc or GitHub milestone, in the order
they're listed (manager's priority order). Skip the section entirely
when there are no projects.

```
📋 *Project pulse*

*<project title>* — <doc link>
- ✅ <milestone> — shipped <date> (<PR link>)
- 🟢 <milestone> — moving (<N PRs in window>, latest: <link>)
- 🟡 <milestone> — quiet (<N> days, target <date>)
- 🔴 <milestone> — blocked: <reason from project doc>
- ⏳ <milestone> — uncertain linkage; ask the team

*<next project>* — ...
```

Per-project rules:

- **At most 5 milestones per project** in the digest. If the doc has
  more, prefer ones that are moving / quiet / blocked over ones already
  done. Already-done milestones older than 14 days are dropped.
- If a project doc has no parseable milestones, render a single line:
  `*<title>* — no milestones detected; <doc link>`. Don't fabricate.
- If every milestone is done or moving, render the title line plus
  one summary line: `🟢 on track — N moving, M done`.

## Active incidents

Most urgent first.

```
🚨 *Active incidents*
- <severity> <service>: <title> (<owner>) — <link>
- ...
```

Use `🚨` only if the section has content. If no active incidents,
omit the whole section.

## Stuck PRs

```
🟡 *Stuck PRs* (<active count>, plus <ancient count> ancient)

_5–90 days, oldest-first:_
- @<login>: <title> — open <N>d, <state> (<link>)
- ...

_>90 days (likely abandoned — close or revive):_
- @<login>: <short title> — <N>d (<link>)
- ... (cap at 5; print "and <X> more" if more)
```

`<state>` indicates *why* it's stuck: `awaiting review`, `awaiting
author`, `merge conflict`, `failing CI`. Don't write generic "stuck"
when the data shows the specific cause.

Cap active stuck at 10 (oldest-first). Ancient bucket caps at 5
examples — the count is the signal, not the list. If active count is
zero but ancient count is non-zero, still print the section — surfacing
"3 PRs >90 days, no active blockers" is the right vibe check.

Stuck PRs are listed as project blockers — not as an IC scoreboard.
The `@<login>` is for ping convenience, not attribution.

## Overdue issues

```
🔴 *Overdue issues* (<count>)
- @<login>: <title> <issue link> — <reason> (P<priority>, <state>)
- ...
```

`<reason>` is one of: `past target date`, `open <N>d at P1/P2`, `no
activity in <N>d`. When more than one applies, use the first in the
priority order in [risk-rules.md](risk-rules.md).

Cap at 10.

## Service health

```
🛠 *Service health*
- <service>: <count> failing CI runs in 24h (most recent: <link>)
- <service>: <count> active alerts
- ...
```

Only listed services that are not green. If everything is green,
omit the section.

## On-call right now

```
📟 *On-call*
- <service>: @<login> (until <date>)
- ...
```

Always shown if an on-call schedule is configured. Useful even when nothing
else is wrong — the manager wants to know who's holding the pager.

If a schedule shows a gap (no one assigned in the next 24h), flag:

```
- <service>: ⚠️ NO COVERAGE for <time window>
```

If someone is back-to-back (just finished a rotation, immediately
starting another), flag:

```
- <service>: @<login> (back-to-back — finished <prior service> <date>)
```

## No per-person activity section

The digest has no "quiet team members" or commit-cadence section.
Commit cadence per person is more surveillance than signal — PTO,
design weeks, review-heavy work, and bunched-up commits all show up
identically. If a teammate is genuinely stuck or disengaged, that
surfaces through stuck PRs, overdue issues, or 1:1 conversation, not a
daily alert.

## Footer

If projects are configured and Project pulse is the only section with
content (every other section empty), print a green-vibe footer:

```
✅ Projects moving, nothing else flagged.
```

If no projects are configured and every cross-cutting section is
empty, print:

```
✅ Nothing flagged.
```

## Tone and style

- **No editorializing.** Don't grade situations. State the facts. The
  manager grades.
- **Use `@<login>` notation.** Most chat tools auto-mention when pasted, but only
  if the manager actually wants to ping. Default is just identifier.
- **Links are bare URLs**, no embedded text. The receiver's renderer
  will handle.
- **Severity emojis stay at the section header**, not on each item —
  except Project pulse, where per-milestone state emojis carry the
  signal.
- **No "today I noticed" prose between sections.** Sections, bullets,
  done.

## Anti-examples

| Bad | Why |
|-----|-----|
| `🟡 *Stuck PRs* (3) - PR #1234 — needs love!` | "needs love" is editorializing |
| `🚨 ALERT! ALERT! Critical incident in payment service!!!` | Caps and emphasis are noise |
| `🟡 Stuck PR: did you know that PRs over 5 days old often indicate a deeper problem?` | The skill does not lecture |
| `📋 *Project pulse*: @login is behind on milestone X` | Per-IC framing — projects move, not people. Use the milestone state emojis. |

## Examples

**Healthy week:**

```
*Team pulse — 2026-06-09*
9 reports · weekly mode · 3 active projects

📋 *Project pulse*

*Billing migration* — ~/notes/planning/billing-migration.md
- 🟢 on track — 4 moving, 1 done

*Search indexer v2* — https://docs.example.com/search-indexer-v2
- ✅ schema backfill — shipped 2026-06-04 (https://github.com/acme/...)
- 🟢 retry/backoff — moving (2 PRs in window)
- 🟡 incremental reindex — quiet (8d, target 2026-06-20)

*Checkout redesign* — https://docs.example.com/checkout-redesign
- 🟢 on track — 3 moving

📟 *On-call*
- service-a: @oncall-a (until 2026-06-12)

✅ Projects moving, nothing else flagged.
```

**Mixed week:**

```
*Team pulse — 2026-06-09*
9 reports · weekly mode · 4 active projects

📋 *Project pulse*

*Billing migration* — ~/notes/planning/billing-migration.md
- 🔴 Q3 milestone: payment provider cutover — blocked: waiting on vendor contract (per project doc)
- 🟡 invoice export parity — quiet (12d)

*Search indexer v2* — https://docs.example.com/search-indexer-v2
- 🟢 on track — 3 moving

🚨 *Active incidents*
- SEV2 service-a: failed deploy on staging (@owner1) — https://acme.pagerduty.com/incidents/12345

🟡 *Stuck PRs* (3)
- @author1: refactor indexer — open 7d, awaiting review (https://github.com/acme/...)
- @author2: lookup helper — open 9d, merge conflict (https://...)
- @author3: cli flag — open 6d, failing CI (https://...)

🔴 *Overdue issues* (1)
- @assignee1: Invoice totals off by one cent https://github.com/acme/billing-service/issues/876 — past target date (P2, In progress)

📟 *On-call*
- service-a: @oncall-a (until 2026-06-12)
- service-b: @oncall-b (until 2026-06-15) — back-to-back, finished service-c 2026-06-08
```
