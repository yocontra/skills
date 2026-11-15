---
name: runbook
effort: medium
description: Runbook and on-call documentation for a production service — create, restructure, or audit one. Onboarding-first structure, anti-drift design, alert inventories, troubleshooting playbooks; every link masked, never a raw URL.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Agent
  - AskUserQuestion
---

$ARGUMENTS

# Runbook Authoring Guide

Write runbooks that are useful on day one, stay accurate over time, and work for both new hires and experienced on-call engineers. The patterns fit any stack: Kubernetes, VMs, or serverless; PagerDuty, Opsgenie, or a chat-only rotation; Prometheus/Grafana, Datadog, Honeycomb, Splunk, Sentry, or whatever the team runs. Discover the stack from the repo; never ask what the repo or the environment can answer.

**Output:** Markdown in the repo by default, at `docs/runbook.md` (or `docs/runbooks/<service>.md` when a `docs/runbooks/` directory exists, or the existing runbook's path when restructuring or auditing). Publish to a wiki or doc tool only when the user names one, and keep the repo file as the source of truth.

---

## Core Principles

**Onboarding-first, action-second.** Start with context so someone new can orient themselves, then move to operational procedures. A runbook that only works for people who already know the system isn't a runbook — it's a cheat sheet.

**Design against drift.** Every fact in the runbook will eventually become wrong. Minimize this by: linking to authoritative sources instead of copying data, documenting WHERE configs live (not just what they are), and building review cadences into the on-call rotation.

**Concise with context.** Write a sentence or two explaining WHY before each procedure. Don't write tutorials, but don't be so terse that someone unfamiliar can't follow. The goal is: "I've never seen this alert before, and this runbook tells me what to do in 60 seconds."

**Mask all links.** Never show raw URLs in prose or tables. Use `[Descriptive Text](url)` everywhere. A clean Quick Links table with short labels is far more useful than a wall of URLs. URLs inside commands in code blocks (`curl https://.../health`) are commands, not links, and stay as they are.

**Source playbooks from real incidents.** Don't invent hypothetical failure scenarios. Search the issue tracker, Sentry, PagerDuty, and Slack history for actual outages and distill them into playbooks. Each playbook follows: Symptoms → Likely Cause → Investigation → Resolution.

**Close the feedback loop.** Every postmortem/PIR should result in a runbook update. If an incident revealed a gap in the runbook, fix it before closing the PIR. The runbook is a living document that gets better with every incident.

**SLO-aware severity.** When documenting alert response, connect each alert to the SLO it protects. This helps on-call engineers prioritize: "This alert means our 99% availability SLO is burning" vs. "This is a non-SLO cosmetic issue."

---

## Document Structure

Use this section order. Each section has a specific purpose — don't merge or reorder without reason.

```
1. Overview & Quick Links
2. Onboarding Checklist
3. Architecture Overview
4. Infrastructure Reference
5. On-Call Schedule & Expectations
6. Alert Sources & Configuration
7. Alert Triage & Response
8. Troubleshooting Playbooks
9. Incident Management & Communication
10. Escalation Paths
11. Release & Deployment
12. Tooling (Claude Code Skills, CLI tools, etc.)
13. Alert Misses
```

See [structure-template.md](references/structure-template.md) for the full template with guidance for each section.

---

## Anti-Drift Patterns

The #1 failure mode of runbooks is drift. Here's how to prevent it:

### Link, Don't Copy

| Instead of... | Do this... |
|---------------|-----------|
| Inline on-call schedule table | Link to PagerDuty schedule |
| Listing current alert thresholds | Link to the alert rule (Prometheus rules file, Grafana, Honeycomb, Sentry) |
| Copying deployment steps from CI config | Reference the Makefile target or CI pipeline |
| Listing access-group members | Link to the group management page |

### Document Config Locations

For every piece of operational state, document WHERE it's configured:

```
| Alert | Configured In | How to Change |
|-------|---------------|---------------|
| API error rate > 5% | Honeycomb trigger "api-error-rate" | Honeycomb UI → Triggers |
| Pod restart loop | Liveness probe in chart/templates/deployment.yaml | PR to helm chart |
| p99 latency > 2s | PrometheusRule `checkout-latency` in deploy/alerts.yaml | PR to the alerts file |
```

### Built-In Review Cadences

Write these into the on-call responsibilities:
- **Weekly:** "Review runbook for any alerts that fired but aren't documented"
- **Monthly:** "Check that all linked resources still resolve"
- **Quarterly:** "Audit alert configs in PagerDuty/Prometheus/Sentry/Honeycomb against the runbook table"

### Alert Misses Are Not Best-Effort

Alert misses (incidents that SHOULD have paged but didn't) must receive dedicated fix time. They build up and cause real pain. Document them in a separate tracking doc and assign fix time every on-call rotation.

See [anti-drift-checklist.md](references/anti-drift-checklist.md) for the full audit checklist.

---

## Section Guidance

### 1. Overview & Quick Links

One paragraph describing the service. Then a table with ALL key resources — masked links, short labels. Group by type: monitoring, infrastructure, code, docs.

Include health endpoint curl examples — these are the first thing an on-call engineer runs.

### 2. Onboarding Checklist

Every access requirement needed before first on-call rotation. Group by:
- System access (PagerDuty, logs, Sentry, Grafana/Honeycomb, Kubernetes)
- Group memberships (SSO / identity-provider groups)
- Slack channels (with purpose for each)
- Local setup (tooling, kube context)

### 3. Architecture Overview

Dependency tree showing what the service talks to. For each dependency, one sentence describing its role. Then a cascading failure table:

```
| Service Down | Impact on Our Service |
|--------------|----------------------|
| ...          | ...                  |
```

Note any resilience patterns (durable queues, circuit breakers, graceful degradation).

### 4. Infrastructure Reference

Kubernetes clusters and namespaces, database instances, connection strings, integration support channels. Step-by-step procedures for common infra tasks (new DB provisioning, etc.).

### 5. On-Call Schedule & Expectations

- Link to the PagerDuty schedule. A schedule pasted inline goes stale the first time rotation changes.
- Hours and response expectations (business hours vs. off-hours)
- Daily and weekly responsibilities
- Whether on-call person has other duties (e.g., release manager)

### 6. Alert Sources & Configuration

Inventory table with one row per alert, not per tool: what fires it, the exact place its threshold is configured (the Prometheus alerting rule, the Honeycomb trigger, the Sentry rule, the probe in the deployment manifest, the chart value), how a change to it gets made, and what to do. Use the columns from Document Config Locations above. This is the anti-drift anchor — if people know where alerts are configured, they'll update the runbook when they change them.

Include Kubernetes probe configs with time-to-restart calculations.

### 7. Alert Triage & Response

Generic first steps for any alert. Then specific procedures per alert type (Sentry error, Postgres connection spike, etc.). Include severity classification and escalation timelines.

### 8. Troubleshooting Playbooks

Source from real incidents (issue tracker, PIRs, Sentry, Slack history). Each playbook:
- **Symptoms:** What the on-call engineer observes
- **Likely cause:** Most common root cause (distinguish "never worked" from "suddenly broken")
- **Investigation:** Specific commands and checks to run
- **Resolution:** How to fix it, who to escalate to

### 9. Incident Management & Communication

**Channel routing table** — which Slack channel is for what purpose. People get this wrong constantly.

**Incident workflow** — exact steps to declare and run an incident in the team's tool (PagerDuty incident, Slack incident bot, or a manual channel), who becomes incident commander, and where the PIR gets written.

**Two paths:**
- Outages → declare an incident (dedicated channel, incident commander, PIR afterwards)
- Non-outage bugs impacting users → Direct post in user-facing channel

**Communication to users** — where to post (status page, maintenance banners, Slack).

### 10. Escalation Paths

Table format: situation → action. Include:
- Auto-escalation path (PagerDuty)
- Human escalation (who to @ mention, where)
- Per-integration escalation channels

### 11. Release & Deployment

- Schedule (day, time, who owns it)
- QA checklist (what to test, where to test it)
- Release commands
- Deadline rules (what happens if you miss the window)
- Post-release verification steps
- Rollback procedures (preferred, manual, emergency)

### 12. Tooling

Document any automation available to on-call (Claude Code skills, CLI tools, scripts). Include example usage so people actually use them.

### 13. Alert Misses

Link to the tracking doc. Emphasize that fixing alert misses gets dedicated time, not best-effort attention.

---

## Workflow: Creating a New Runbook

1. **Gather context** — Search the issue tracker, PIRs, Slack, Sentry, PagerDuty, git history, and logs for the service's incident history. Identify the top 5-10 failure patterns.

2. **Answer the key questions from the sources** — and when a source does not answer one, write the section on a sensible default marked **Assumption:** and add the question to the closing batch. Do not wait for answers before drafting:
   - Off-hours expectations?
   - Incident management process (PagerDuty incidents? Incident bot? Status page? Manual Slack post?)
   - Release cadence and who owns it?
   - Severity classification system?
   - Rollback procedure?
   - Any credentials requiring manual rotation?

3. **Cross-verify facts** — Check the actual codebase: health endpoints (grep for `/health`, `/ready`, `/live`), probe and resource config (Kubernetes manifests, Helm charts, Terraform, serverless config), alert rules (`*rules*.y*ml`, Terraform monitors, Sentry or Honeycomb config as code), telemetry SDK setup, and CI/CD config. Don't trust verbal descriptions alone.

4. **Search the issue tracker for outage patterns** — Query the service's issues and past PIRs for high-severity incidents. Run 2-3 searches in parallel with different terms (auth failures, timeouts, connection pool, etc.) from this session rather than spawning agents for them. Distill into troubleshooting playbooks.

5. **Write the runbook** — Follow the structure template. Mask all links. In the alert inventory, fill every row's Configured In and How to Change with the concrete system of record — the Prometheus rule or Honeycomb trigger by name, the Sentry alert rule, the probe in `chart/templates/*-deployment.yaml`, the threshold in `chart/values.yaml`, the per-workflow setting — and the path a change takes (UI, PR to the chart). A bare `[where]` placeholder there is the first thing to go stale. When the service's alerts are not known yet, as in a first draft, write one example row per alert source with its likely system of record filled in (the table in the structure template shows them) and mark each to confirm, rather than collapsing the table to a single placeholder row. Source playbooks from real incidents. Name the stack the team runs on — for example PagerDuty for paging, Prometheus/Grafana and Honeycomb for metrics and traces, Sentry for errors, the team's incident tool to declare an incident, a status page for what customers are told — rather than shipping `[PAGING TOOL]` placeholders. Infer the stack from the repo (alert rules, chart values, SDK dependencies) where you can. When the repo says nothing, write the document on the stack this plugin covers — PagerDuty (paging and declaring incidents), Honeycomb (traces and metrics), Sentry (errors), Splunk (logs) — named in the checklist, alert table and incident steps, and list in one line which of them the team should confirm. Target format: markdown in the repo's `docs/` directory, or a doc tool the team names. If the file cannot be written from this session, put the full runbook in the reply rather than a description of it.

6. **Assign ownership** — Every runbook needs an owner (usually the on-call rotation collectively). Document who maintains it and the review cadence at the top of the doc.

7. **Report and ask once** — Report the path written and the assumptions made, then list every open question in one batch at the end, with a recommendation that an on-call engineer review the procedures.

---

## Clean up and exit checklist

This skill writes one document. Anything else it creates is scratch: link-check output, fetched pages, or notes kept between steps go in `D=$(mktemp -d); trap 'rm -rf "$D"' EXIT`, never in the repo. Remove them before finishing. Health-endpoint checks are read-only `curl` calls; do not run commands from a playbook that change production state just to verify them.

- [ ] Runbook written to the repo path above (or the path the user chose)
- [ ] Every link masked; every alert row names where it is configured and how it changes
- [ ] Facts the team must confirm are marked as such, not presented as verified
- [ ] Published to a wiki or doc tool only when the user named one
- [ ] Open questions asked once, in one batch at the end of the reply
- [ ] Scratch files removed

## Workflow: Auditing an Existing Runbook

Use the [anti-drift-checklist.md](references/anti-drift-checklist.md) to systematically verify:
- All linked resources still resolve
- Alert inventory matches current configs
- Escalation contacts are still correct
- Release procedure matches current process
- Troubleshooting playbooks cover recent incidents
- No inline tables that should be links to authoritative sources
