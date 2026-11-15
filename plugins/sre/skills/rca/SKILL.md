---
name: rca
effort: medium
description: Author a post-incident review (PIR), postmortem, or root cause analysis (RCA) by pulling incident data and drafting the whole document with marked assumptions, then file corrective actions in the issue tracker. Open questions come in one batch at the end. Writes Markdown into the repo by default.
allowed-tools:
  - AskUserQuestion
  - Read
  - Write
  - Edit
  - Bash
---

$ARGUMENTS

# RCA / PIR Authoring

Gather from every source you can reach, draft the whole document, write it, file the CAs, then ask any remaining questions in one batch at the end. **The CAs are the point** — every decision should serve making the CA list useful and actionable. Everything else is supporting context.

See [rca-template.md](references/rca-template.md) for the canonical structure, severity scale, detection categories, CA types, and anti-patterns. This file is the drafting order and the production rules — definitions live in the template.

---

## Output mode

Gather everything first, then write the document as Markdown:

- **File:** `docs/rca/<YYYY-MM-DD>-<slug>.md` if `docs/rca/` exists, else `RCA-<YYYY-MM-DD>-<slug>.md` at repo root. `<slug>` is kebab-case of the short title. Title: `<YYYY-MM-DD> <Team> RCA -- <short title> (<Root Cause>)`.
- **Doc tool (optional):** if the user names one (Confluence, Google Docs, Notion, ...) and a tool or MCP server for it is available, publish there as well. The local Markdown file stays the source of truth; the doc tool is its publish target.

If the user explicitly asks for one mode, honor it.

---

## Pre-RCA: gather data before drafting

Users don't remember exact times under fire; the systems do. Pull hard data before you write a section, and never ask for what a source can answer.

**First, find out what the team runs.** Check which CLIs are installed (`command -v pd gh glab sentry-cli kubectl`), which MCP tools this session has (chat, docs, issue trackers), and what the repo names: alert rules, SDK dependencies, CI config, `docs/rca/`, the runbook. Use those; do not ask the user which tools they have when the repo or the environment already says.

The first three rows are required on every PIR and come before the draft: when the user names only the incident, you still pull its chat channel and the service's prior PIRs yourself. Find the channel from the incident record (its chat or conference link, or notes) or a channel search for the incident ID or service name; do not ask the user which channel it was. Run the rest in parallel where the source exists.

| Source | How (use whichever the team has) | What you get |
|--------|----------------------------------|--------------|
| Incident record | PagerDuty `pd rest get -e /incidents/<id>` and `pd incident log -i <id>`; Opsgenie, incident.io, FireHydrant, or the tracker issue through their CLI or MCP tool | Open/ack/resolve timestamps, responders, notes |
| Incident chat channel | Slack or Teams MCP tool (channel history for the incident window) | Who saw what when, mitigations tried, decisions not in the timeline |
| Prior PIRs | `ls docs/rca/ docs/postmortems/ 2>/dev/null` and `grep -ril '<service>' docs/`, or a search in the team's doc tool | Repeat causes, and CAs that were filed and never closed |
| Alerts | PagerDuty `pd incident alerts -i <id>` for the incident's alerts, and `pd rest fetch -e /incidents -P 'service_ids[]=<id>' -P 'since=...' -P 'until=...' --limit 50` for other incidents on the service in the window; or the alerting tool's history | Alarm fire times, integration source, thresholds |
| Deploys | `gh run list --workflow <deploy> --limit 20 --json createdAt,conclusion,headSha`, `glab ci list`, Argo CD or Helm history (`helm history <release> --max 10`) | Deploy start/finish, triggering commit |
| Logs and metrics | The team's log or metrics tool over the impact window only (Splunk, Loki, CloudWatch, Datadog, Prometheus), aggregated with `stats`/`count`, never raw dumps | Error counts, signatures, what is *not* shipped |
| Errors and traces | Sentry issue counts and user counts, Honeycomb or Jaeger traces for the window | Affected users, failing span or release |
| Git | `git tag -l 'v*' --sort=-creatordate \| head -20`, `git log --pretty='%h %ai %s' <range>` | Release-tag times, commit subjects |
| Existing issues | `gh issue list --search '<topic>' --state all --limit 20`, or the tracker's search | Reuse existing issues; don't duplicate |
| Runbook | Read it from the repo | Playbook gaps that should become CAs |

Pre-RCA findings often *change* the questions you'd otherwise ask. For example:

- Logs reveal the failing system's access logs aren't shipped: that absence is itself a CA, and "quantify request loss" becomes a record-only CA blocked on the infra fix.
- CI shows the deploy was marked failed because post-deploy verification failed, but the image rolled out earlier in the run. Impact-start is the rollout time, not the failure time.

If a source is unreachable from here (no token, no network path), keep drafting: mark what it would have supplied `TBD (needs <source>)`, and put the link the user can open in the closing question batch. Every query is bounded to the incident window and aggregated; do not page through raw logs.

## Existing draft handoff

If an incident tool already generated a draft PIR or summary, augment it: fill the gaps and fix the structure, unless the user asked for a fresh document. Say which you did in the report.

An auto-generated summary is a starting point, not finished. If the tool captured Time-To metrics (Detect, Engage, Diagnose), pull them from it rather than re-derive.

---

## Drafting order

Draft every section from the pulled data in this order, without waiting for answers between sections. Where a fact is missing, write `TBD` or a line marked **Assumption:** with its basis, and add the question to the closing batch. When the data sources are out of reach from this session, still write the full skeleton with every section, fill what the request gives you, and invent no timeline entry or cause.

### 1. Identity

Title, date, team, tracking issue (often filed later as a parent issue — `TBD` is fine here), incident ID or URL, Authors, Presenters, Reviewers.

### 2. Categorical fields

Pick each from the evidence and mark it as an assumption when the evidence is thin:

- Severity — Sev 1 / Sev 2 / Sev 3
- Detection method — Alarm / Customer / Internal / Synthetic / Bug report
- Impact type — Complete outage / Degradation / Data loss / Latency / Partial / Internal-only
- Was this avoidable? — Yes / No / Partially

### 3. Impact

One-line summary, impact start/end, quantified scope (users, requests, downstream services). A vague number goes in the closing batch, not in the doc as fact.

**Quantify data loss from logs when possible.** If the evidence shows request or message loss, count it in the team's log store for the impact window. If the data isn't there (for example, proxy access logs aren't shipped), that is itself a CA: note it as a detection gap and continue.

### 4. Timeline

Build it from whatever the sources give (incident log, chat history, deploy runs, or a timeline the user pasted). Normalize to the template's table format. Include both response and causal events. Pick one timezone, usually UTC (or add the team's local time for daytime entries — `HH:MM UTC (HH:MM local)` is fine).

Highlight the two key rows in **bold**: when impact begins and when crashes/outage stops. Readers scan the timeline column-first; the bolded rows anchor the rest.

### 5. Time-To Metrics

If not pulled from an incident tool, derive from the timeline now: Detect, Engage, Diagnose, Mitigate.

**Anchor TTD to impact-start, not deploy-start, for load-dependent bugs.** If a race condition only fires under business-hours load and the deploy ran at 00:30 local time, the deploy-to-impact gap (~9h) is a property of the bug's load dependence, not a monitoring failure. Show both numbers when useful: `~12 min from impact-start, ~9h from deploy-time`. Don't overstate detection failure.

If detection signal A fires before signal B (user complaint at 09:12 UTC, alarm at 09:38 UTC), record both. An alarm firing *after* the human signal is a detection gap — surface it.

### 6. Detection (separate from metrics)

**How was it detected?** List signals in order. Quote the actual log signature or alarm message if you have it; concrete evidence is more useful than the team's narration.

**Detection gaps** — render as a small table of `Gap → Implication`. Common patterns:

- "Alarm depends on the failing system emitting telemetry" — Honeycomb/Sentry/in-process metrics fail when pods crash
- "External signal exists but is not wired to paging" — e.g. load-balancer error rates graphed but not alerting
- "Signal X is not shipped to the long-term store" — verify in the log store before claiming this
- "No standalone external probe" — synthetic / blackbox / upstream LB uptime check absent
- "Process-level signal masked" — SIGABRT → exit 0, OOM-killed → silent restart, etc.
- "Heavy release made root-causing slower" — many candidate changes to bisect
- "No post-deploy synthetic load" — off-hours deploys hide load-dependent bugs

Each detection gap should map to a CA later. If it doesn't, you missed a CA.

### 7. Root Cause

Three questions: what failed, why that caused this outcome, why it wasn't caught earlier. Follow "why" through the evidence until you hit a systemic cause, then list contributing factors. Mark any link in the chain that rests on inference rather than evidence.

**Look for "one root cause, two failure surfaces" patterns.** When the inciting change exposes a *latent* bug elsewhere (not just the change's own bug), name both. Without naming both, the RCA understates the work.

Errors here cascade: every inferred step in Timeline, Root Cause, or Contributing Factors gets a question in the closing batch.

### 8. Why rollback was not selected (if applicable)

Often a missing section. State **the actual reason** rollback wasn't chosen, in plain causal language. Common real reasons:

- **Coupled-subsystem state** — downstream services are now in a state the previous version hasn't seen, and verifying compatibility takes longer than the forward fix
- **Irreversible migration with `NotImplementedError` downgrade** — be honest if the framework supports rollback in general but this specific migration was lossy
- **Configuration kill switches existed but weren't on the runbook** (note this as a CA)

**Don't overclaim.** If migrations *generally* roll back fine and only this release was hard, say that. Don't propose a CA for "make migrations rollback-able" if they already are; the real CA might be "document existing kill switches on the rollback runbook."

Mid-incident automation hotfixes (helm timeout bumps, escape hatches added) belong in this section as record-of-fact, not as forward CAs.

### 9. Recurrence (if applicable)

If this is the Nth occurrence of the same root cause, render a small table:

| Date | Issue / PR | Failure |
|------|------------|---------|
| YYYY-MM-DD | #X / PR #Y | Description |
| YYYY-MM-DD | #X / PR #Y | Description |
| (this) | this incident | Description |

Recurrence is evidence of a process gap (no upstream fix attempted, workaround didn't generalize, prior fix's scope too narrow) — surface that as a CA. "We hit it again" is not a CA; "establish working OSS upstream-contribution path" or "lint to prevent the third-party variant" is.

### 10. Remediation

Immediate mitigation (rollback, scaling, manual intervention) and long-term fix. State each fix in one sentence and link the commit. **The commit diff is the design** — don't write the design twice.

PR links and commit links are mandatory — see "Linking commits and PRs" below.

### 11. Stakeholder Notification

Was it sent? To whom? Status page updated? One short paragraph or "N/A".

### 12. Previous / Related Incidents

Links to prior occurrences. Skip if already covered by a Recurrence section.

### 13. What Went Well

One or two factual bullets. Skip if there are none. **Don't reach.** "We followed the runbook" is the baseline, not a "went well" item. "The existing `_guard_ssl_context_mutation` was reusable for the new monkey-patch" is concrete and useful.

### 14. Corrective Actions — the work

The section the doc exists for. Each CA needs:

- A discrete deliverable (something a reader can scope into a sprint)
- An issue link (`TBD` only if not yet filed)
- A type — Detect / Mitigate / Prevent
- A priority — P1 / P2 / P3 (the template's three tables)

#### What's NOT a CA

Leave these out of the list, and say why in the report when the user proposed one:

- **Incident close-out tasks** — "Verify zero recurrence over 24h" is an incident close-out checklist item, not a tracked CA. Drop or convert.
- **Busywork on a deprecating dependency** — "File a courtesy issue against X" when CA #1 is "Stop using X entirely". Drop the courtesy issue or downgrade to defensive fallback.
- **Redundant detection paths** — lint + integration test for the same failure mode is one CA, not two. Pick the cheaper signal.
- **Cultural advice without a deliverable** — "Move away from big-bang releases" is hard to track as an issue. Convert to "draft release-cadence guidelines" with concrete acceptance criteria, or fold the narrative into Contributing Factors and drop the CA.
- **Retroactive curiosity blocked on infra CAs** — "Quantify webhook loss for this incident" when no log exists. Either it's unrecoverable (record-only), or it's blocked on the infra CA (note the dependency).
- **Mid-incident hotfixes already landed** — don't re-list as CAs. Move to Why Rollback Was Not Selected or Remediation.
- **Failure-specific runbook playbooks** — "Add a `Glibc Abort in Pod Logs` playbook" is too specific; the underlying bug is being fixed at the source. Generalize ("Helm pending-rollback recovery" is broad enough), or drop.

#### CA grouping for the published doc

When publishing, **split CAs by priority** into separate small tables (P1 / P2 / P3). One wide table with 13 rows of wall-of-text is unreadable. Three short tables grouped by priority scan in seconds.

Keep CA descriptions to 1-3 sentences. Concrete action verb up front. Reference the issue; don't re-explain the action there.

#### CA-list weeding pass

Before filing issues, weed the list yourself. Common weeds:

- Detection-only CAs that overlap (lint vs. test vs. canary for the same failure mode)
- Mitigation CAs whose underlying problem is being fixed by another CA in the same list
- Cultural CAs without a discrete deliverable

A first-draft CA list typically loses 30-50% once the overlaps are visible. Name each dropped or merged CA in the report.

### 15. Status

Set at publish time. Almost always `Draft`.

---

## Closing the loop: file issues, publish, mark complete

After the draft is written:

### A. Search for existing issues before filing

Before filing a new issue for each CA, search the project's tracker:

```bash
gh issue list --search '<topic-keywords>' --state all --limit 20 --json number,title,state
```

For Jira, Linear, or another tracker, use its search (MCP tool or CLI). If an issue already exists for the CA's topic, put its link in the Issue column and note `REUSE` — don't file a duplicate.

### B. Draft all issue bodies in a scratch directory

Draft into a scratch directory, not the repo:

```bash
RCA_TMP=$(mktemp -d "${TMPDIR:-/tmp}/rca-issues.XXXXXX")   # print it and reuse the path in later commands
# $RCA_TMP/issues.md holds every draft; $RCA_TMP/i0.md, i1.md, ... one body per issue
```

No `trap ... EXIT` here: each shell call ends its shell, so a trap would delete the drafts before they are filed. Remove the directory explicitly in step F.

One issue per CA, each with Summary, Action, Context, and References, all referencing a parent incident issue. Filing notifies people, so file only the weeded set, reuse existing issues, and keep each body factual. File in the same run; filing does not wait on the closing questions. A CA drawn from the user's account rather than pulled evidence is still filed, with its source stated in Context.

### C. File parent first, capture its number, substitute into children

```bash
gh issue create --title "<title>" --body-file "$RCA_TMP/i0.md" --label incident
```

Capture the parent's number or URL and substitute it into every child CA's References section before filing. Label CAs with type and priority; owners and due dates are usually set later. Use the tracker's CLI or MCP tool for Jira, Linear, or GitLab. Only use labels that exist (`gh label list --limit 100`); skip a missing label and name it in the report.

### D. Update the local RCA file with all issue links

Each CA's Issue column gets its filed link, and the parent incident issue goes in the doc's top-level **Tracking issue** field. Mirror to the published doc-tool copy if one exists.

### E. Incident close-out

1. If the incident is still open in the paging or incident tool, resolve it only when the request asked for that; otherwise name it as still open in the report.
2. Link the RCA from the incident record and the parent issue with a note or comment, and list each in the report.
3. Remind the user to hold the review meeting, typically within 5 business days, and to mark the RCA `Status: Complete` afterwards.

### F. Clean up and exit checklist

Remove what this session created outside the RCA file: `rm -rf "$RCA_TMP"` once the issues are filed, plus any query output saved while gathering data. Keep the RCA Markdown file; it is the deliverable.

- [ ] RCA written to `docs/rca/<date>-<slug>.md` (or the file the user chose), every commit, PR, and issue linked
- [ ] No invented times, names, or numbers; gaps marked `TBD`
- [ ] Every assumption is marked in the doc, and every open question is in one batch at the end of the reply
- [ ] Issues filed from the weeded set, existing ones reused, and their links written back into the RCA
- [ ] No incident resolved unless the request asked for it
- [ ] The report lists the RCA path, each issue filed or reused, and each note posted
- [ ] `$RCA_TMP` and other scratch files removed

---

## Voice and tone

The RCA is a record of facts and actions. Not narrative, opinion, or commentary. Strip editorializing on every pass — your own and the user's.

**Cut these on sight:**

- Adjectives describing the team's experience rather than the incident: `extraordinarily`, `unusually`, `surprisingly`, `materially`, `notably`, `crucially`, `inadvertently`, `unfortunately`, `obviously`, `simply`.
- Narrative phrases: "the team had to", "the saga", "under fire", "a 6-hour ordeal", "the right call", "good news / bad news", "saving grace", "operational debt", "right choice".
- Self-judgmental framing: "self-inflicted", "should have known", "in hindsight", "we got lucky".
- Concluding paragraphs that interpret the facts: "Net effect:", "The takeaway is:", "Lessons:". The CA section is the conclusion. Don't write a second one in prose.
- First-person voice: "I deployed", "we decided", "the team chose". Use neutral causal language: "rev 199 was deployed", "rolling forward was selected over rollback because...".
- Hedging that signals opinion: "arguably", "perhaps", "to be fair".
- Severity adjectives on the bug itself: "obscure", "deep edge case", "subtle race", "tricky". Either the technical description makes it obscure or it doesn't.

**Keep these — not editorializing:**

- Quantified facts: "alarm fired at 16:38:21 UTC", "8/8 pods CrashLoopBackOff'd", "threshold tripped at 2.848k".
- Causal language tied to evidence: "the deploy failed because the post-deploy verify gate could not exec into a crash-looping pod".
- Direct statements of what was tried and what happened: "rev 196 attempted to roll back to 194 and got stuck in `pending-rollback`".
- Reasons for chosen actions when stated as fact: "rollback was not selected because verifying compatibility with the now-mutated downstream queue state could not be answered quickly".

**Test:** if a sentence could be cut without losing a fact, a timestamp, a file path, or an action, cut it. RCAs that read like trip reports get skimmed; RCAs that read like ledgers get used.

---

## Don't over-explain

Reference, don't re-derive. The RCA names internal utilities, environment variables, and migration files; it does not explain how they're implemented. Readers can `grep` for any name in the doc — they don't need a parenthetical aside on how it works under the hood.

**Cut these on sight:**

- **Implementation walk-throughs of named utilities**: ``via `common.async_utils.run_async_in_thread` (which wraps `asyncio.run(coro)` inside `anyio.to_thread.run_sync` so the SDK can reach a real asyncio loop)`` → just `via common.async_utils.run_async_in_thread`. The reader can read the function if they care.
- **Internal jargon that means nothing outside the team**: "handshake fan-in", "request density", "concurrent-handshake density". Say "concurrent load" / "request volume" / "concurrent users" instead.
- **Exhaustive enumeration of what tests cover**: ``33 regression tests cover propagated attributes (verify_mode, check_hostname, options, minimum/maximum_version, verify_flags, post_handshake_auth, keylog_filename, set_ciphers/set_alpn_protocols/set_ecdh_curve)`` → ``33 regression tests cover the new lifecycle and a multi-thread interleave that reproduces the race``. The reviewer reads the test file to verify; the RCA records that coverage exists.
- **Architectural deep-dives in Long-term Fix bullets**. State the change in one sentence; link the commit. The commit diff is the design.
- **Padding adverbs and stage-setting clauses**: "Subsequently, the team observed that...", "It is important to note that...".

**Test:** if removing a clause leaves the technical claim, the file path, and the conclusion intact, the clause was over-explanation.

---

## Linking commits and PRs

Every commit SHA, PR number, and issue referenced in the RCA must be a clickable link, not a bare identifier. Bare `5fbf27d33` and `PR #1023` strings force the reader to copy-paste into a browser; in a post-incident review where ~10 commits and ~5 PRs typically appear, that friction is real.

- **Commits:** `` [`<short-sha>`](<repo-web-url>/commit/<sha>) `` — e.g. `` [`5fbf27d33`](https://github.com/acme/checkout/commit/5fbf27d33) ``. Run `git remote get-url origin` (or `git config --get remote.origin.url`) to derive the web URL; convert `git@host:org/repo.git` → `https://host/org/repo` when the remote is SSH. Apply this everywhere a commit appears: Timeline rows, Remediation, References, and any prose body.
- **PRs:** `[PR #<n>](<repo-web-url>/pull/<n>)` for GitHub; `[MR !<n>](<repo-web-url>/-/merge_requests/<n>)` for GitLab; `[PR #<n>](<repo-web-url>/pull-requests/<n>/overview)` for Bitbucket Server. Match the host's actual URL scheme.
- **Issues:** link the full issue URL, or `#<n>` where the renderer auto-links it (GitHub, in the same repo).
- **Image tags** that embed a commit prefix (e.g. `5fbf27d33492-uat`) are image identifiers, not commit refs — leave them as plain code, but link the underlying commit when it's referenced elsewhere as a commit.

Derive the repo web URL from the remote. With no remote, leave the SHAs as code, mark them `TODO: link`, and ask for the URL in the closing batch.

---

## Doc-tool publishing

When publishing to a doc tool, check before the first publish how it renders Markdown tables, and whether its API can edit a single cell or only replace the whole document. Prefer one publish of the final draft over repeated republishing: many doc tools keep every version and cannot delete through the API. Strip non-ASCII punctuation (em dashes, arrows, smart quotes) if the tool mangles it.

---

## Etiquette

- Ask once, at the end: one batch of the open questions (one `AskUserQuestion` call, or a numbered list in the reply), each tied to the `TBD` or assumption it resolves.
- Every issue, comment, or note you post is listed in the report with its link.
- Never invent times, names, or numbers. `TBD` is fine.
- RCA status (Draft → In Review → Complete) is a manual transition. Remind the user once at the end.
