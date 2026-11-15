# RCA / PIR Template

Canonical PIR structure. Omit empty sections. Sections marked `(if applicable)` only render when the incident actually has that material — don't pad the doc with empty headers.

---

```markdown
# {{title}}

**Status:** {{status}} | **Sev:** {{severity}} | **Type:** {{impact_type}}
**Active impact:** {{duration}} | **Incident:** [{{incident_id}}]({{incident_url}}) | **Tracking issue:** {{tracking_issue}}
**Authors / Presenters / Reviewers:** {{authors}} / {{presenters}} / {{reviewers}}

## TL;DR

- **What broke:** {{tldr_what}}
- **Why now:** {{tldr_why_now}}
- **Fix:** {{tldr_fix}}
- **Recurrence:** {{tldr_recurrence}}  *(omit if first occurrence)*

## Time-To Metrics

| Metric | Value |
|--------|-------|
| Detect (user) | {{ttd_user}} |
| Detect (alarm) | {{ttd_alarm}} |
| Engage | {{tte}} |
| Diagnose | {{ttdiag}} |
| Mitigate | {{ttm}} |

## Timeline

*All times {{timezone}} (team-local time in parens for daytime entries).*

| Time | Event |
|------|-------|
{{timeline_rows}}

Bold the row marking impact-start and impact-end so they anchor the rest.

## What Broke

### The bug

{{root_cause_what}}

### How {{system}} was exposed

{{root_cause_how}}

### Why our existing workaround didn't help  *(if applicable)*

{{root_cause_why_workaround_failed}}

### Why this is the {{N}}th occurrence  *(if applicable)*

| Date | Issue / PR | Failure |
|------|------------|---------|
{{recurrence_rows}}

## Impact

{{impact_bullets}}

### {{loss_type}} loss  *(if applicable)*

{{data_loss_paragraph}}

## Detection

**How:** {{detection_signals}}

**Why detection from deploy was {{N}}h:**  *(if applicable, for load-dependent bugs)*
{{detection_load_dependence}}

### Detection gaps

| Gap | Implication |
|-----|-------------|
{{detection_gap_rows}}

## Why Rollback Was Not Selected  *(if applicable)*

{{rollback_paragraph}}

Mid-incident automation hotfixes (independent of the rollback decision):
{{rollback_hotfixes}}

## Fixes Deployed

| Commit | What | Where |
|--------|------|-------|
{{fix_rows}}

## Contributing Factors

{{contributing_factors_numbered_list}}

## What Went Well  *(skip if there are no factual items)*

{{what_went_well_bullets}}

## Corrective Actions

{{ca_total}} CAs filed in {{tracker}}. Owners and due dates pending.

### P1 -- Block next incidents of this shape

| Issue | Type | Action |
|-------|------|--------|
{{p1_ca_rows}}

### P2 -- Strong follow-ups

| Issue | Type | Action |
|-------|------|--------|
{{p2_ca_rows}}

### P3 -- Record-keeping

| Issue | Type | Action |
|-------|------|--------|
{{p3_ca_rows}}

## References

{{references}}
```

---

## Field definitions

### Severity

| Level | Meaning |
|-------|---------|
| Sev 1 | Large impact to revenue or brand reputation |
| Sev 2 | Some impact to revenue/brand; risk of greater damage |
| Sev 3 | No external impact (internal-only) |

### Status

`Draft` → `In Review` → `Complete`. Manual transitions by the author.

### Detection method

- **Alarm** — automated monitoring (Sentry, Splunk, Prometheus, PagerDuty, Honeycomb)
- **Customer** — external user reported via support / Slack
- **Internal** — an employee noticed and reported (most common for internal-only services)
- **Synthetic** — canary or probe failed
- **Bug report** — issue filed independently
- **Other**

### Impact type

Complete outage · Degradation · Data loss · Latency · Partial · Internal-only

### Was it avoidable?

Yes · No · Partially. If `Yes` or `Partially`, the answer must surface as a CA.

### Action item types

- **Detect** — closes a monitoring/alerting gap
- **Mitigate** — speeds up response or reduces blast radius
- **Prevent** — stops the same root cause from recurring

### Timeline rows

`| HH:MM TZ | Actor: action |`. Include both response events (alarms, joins, attempted fixes) and causal events (when the bad change shipped). Commit SHAs and PR numbers in timeline rows must be linked, not bare. Bold the impact-start and impact-end rows.

### CA rows

`| [#N](issue-url) | Detect/Mitigate/Prevent | Concrete action sentence |`. Owner and Due omitted from published tables — they live on the issue itself.

### Linking commits, PRs, and issues

Every commit SHA, PR number, and issue referenced in the doc renders as a clickable link. Applies to Timeline, Remediation, References, prose body, CA tables.

- **Commits:** `` [`<short-sha>`](<repo-web-url>/commit/<sha>) `` — derive `<repo-web-url>` from `git remote get-url origin` (convert SSH `git@host:org/repo.git` → `https://host/org/repo` if needed).
- **PRs:** `[PR #<n>](<repo-web-url>/pull/<n>)` for GitHub-style hosts; `[PR #<n>](<repo-web-url>/pull-requests/<n>/overview)` for Bitbucket Server; `[MR !<n>](<repo-web-url>/-/merge_requests/<n>)` for GitLab.
- **Issues:** the full issue URL, or `#<n>` where the renderer auto-links it.
- **Image tags** that embed a commit prefix (e.g. `5fbf27d33492-uat`) are image identifiers, not commit refs.

---

## Anti-patterns

| Anti-pattern | Better |
|--------------|--------|
| "Human error" as root cause | Why was the system easy to mis-use? |
| "Be more careful" as a CA | Needs a systemic fix |
| No detection finding | If monitoring missed it, that's always a CA |
| Vague impact ("some users") | Quantify: "~50K users for 23 minutes" |
| CA without an owner or date | Won't get done (owner/date can land on the issue later, but track the gap) |
| Skipping the timeline | Timestamps reveal response delays |
| Wall-of-text CA table | Split by priority into 3 small tables |
| First-person voice | Neutral causal: "rev 199 was deployed" not "I deployed rev 199" |
| Listing test attribute names | "33 regression tests cover the new lifecycle" — reviewer reads the test file |
| Re-deriving how a util works | Name it; reader can `grep` |
| "Migrations couldn't roll back" when they generally can | Be specific about which migration and why |
| Filing "courtesy issue" against a dep being removed | Drop the courtesy CA |
| "Verify zero recurrence over 24h" as a tracked CA | Incident close-out checklist, not an issue |
| Failure-specific runbook playbook ("Glibc Abort") | Generalize or drop — runbook is for patterns |

---

## Common contributing factors to look for

Not exhaustive — but every RCA hits at least 2-3 of these. Surface the ones that apply:

1. **In-process latent bug exposed by the inciting change** — same area, different mechanism. The inciting change pushes a load metric over a threshold and surfaces a second bug. Name both.
2. **Recurrence of a known behavior** — Nth time the same root cause has bitten. Prior fix had narrow scope.
3. **Process-level signal masking** — SIGABRT → exit 0, OOM-killed → silent restart, timeout → process kept running. Defeats standard pod-exit monitoring.
4. **UAT/prod load gap** — UAT doesn't run prod-level concurrent load.
5. **Heavy release** — many unrelated changes increase time-to-narrow.
6. **No local break-glass for image rebuilds** — every theory requires a 45+ min CI rebuild.
7. **Chart/code env drift** — chart's secondary container (migration job, sidecar) doesn't propagate the primary container's env surface.
8. **Off-hours deploy with load-dependent bug** — pods look healthy until business-hours traffic resumes.
9. **External signal exists but isn't wired** — proxy access logs, ingress → upstream LB metrics, etc.
10. **Configuration kill switch existed but wasn't on the rollback runbook**.
