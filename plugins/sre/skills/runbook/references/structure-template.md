# Runbook Structure Template

Use this as a starting skeleton when creating a new runbook. Copy each section's content (inside the fenced blocks) into your target document (repo markdown or the team's doc tool). Fill in the bracketed placeholders and remove guidance comments.

**Target format:** Markdown in a repo; also works pasted into a wiki or doc tool.

---

## Section 1: Overview & Quick Links

```markdown
# [Service Name] Runbook

**Owner:** [on-call rotation collectively] | **Last audited:** [date]

[One paragraph: what the service does, who uses it, what it depends on.]

**PROD:** [prod-url] | **UAT:** [uat-url]
**SLA:** [availability target and what it covers]

---

## Quick Links

| Resource | Link |
|----------|------|
| PagerDuty | [Service Name](pagerduty-url) |
| Logs | [Log Search](logs-url) (`index=name` / `{app="name"}`) |
| Sentry | [Sentry Dashboard](sentry-url) |
| Dashboards | [Grafana: Service Overview](grafana-url) |
| Traces | [Honeycomb SRE Board](honeycomb-url) |
| Issue Tracker | [Open Bugs](tracker-url) |
| Status Page | [Status Page Admin](statuspage-url) |
| Source Code | [GitHub Repo](github-url) |

### Health Endpoints

curl https://[prod-url]/health/
curl https://[prod-url]/health/ready
curl https://[prod-url]/health/live
curl https://[prod-url]/health/pool-stats
```

---

## Section 2: Onboarding Checklist

```markdown
## Onboarding Checklist

**System Access:**
- PagerDuty — added to schedule [ID]
- Logs — can query `index=[name]` / the service's log stream
- Sentry — project [ID] visible
- Grafana / Honeycomb — [org] org, prod environment
- Kubernetes — `[cluster]` cluster, namespace `[ns]`

**Group Membership:**
- `[group]` in the identity provider (grants [what])

**Slack Channels:**
- `#help-[service]` — user-facing support
- `#proj-[service]-ops` — alarms and SRE discussion
- [additional channels with purpose]

**Local Setup:**
- Clone repo, install tooling: [commands]
- Kube context:
  [cloud CLI command that writes the kubeconfig, e.g. aws eks update-kubeconfig --name [cluster]]
  kubectl config set-context --current --namespace=[ns-prod]
```

---

## Section 3: Architecture Overview

```markdown
## Architecture Overview

[Service Name]
├── [Auth gateway] (e.g., authentication, mTLS)
├── [Identity provider] (e.g., OAuth2 token exchange)
├── [Database] (e.g., data persistence)
├── [Cache/Queue] (e.g., job queue, caching)
├── [Execution engine] (e.g., pipeline runs)
│   ├── [Sub-dep 1] (e.g., compute platform)
│   └── [Sub-dep 2] (e.g., artifact storage)
├── [Secrets manager] (e.g., inject secrets)
└── [External API] (e.g., AI models, package registry)

**Key behaviors:**
- [Resilience: durable queues, graceful degradation, circuit breakers]
- [Auth: which gateway handles auth before requests reach the service]
- [Recovery: what happens to in-flight work during an outage]

### Cascading Failure Scenarios

| Service Down | Impact |
|-------------|--------|
| [Auth gateway] | [e.g., complete platform outage — no access] |
| [Database] | [e.g., complete outage — all reads/writes fail] |
| [Execution engine] | [e.g., no new work executes; existing data accessible] |
| [Cache/Queue] | [e.g., degraded performance; queued work delayed] |
```

---

## Section 4: Infrastructure Reference

```markdown
## Infrastructure Reference

### Kubernetes
- **Cluster:** `[cluster]`
- **Prod namespace:** `[ns-prod]`
- **UAT namespace:** `[ns-uat]`

### Database
| Environment | Instance | Notes |
|-------------|----------|-------|
| UAT | [host] | Testing |
| Prod | [host] | [which workloads, criticality] |

### Integration Support Channels
| Service | Description | Support |
|---------|-------------|---------|
| [Dep 1] | [what it does for you] | [#help-channel] |
| [Dep 2] | [what it does for you] | [#help-channel] |

### Connecting to the Database
[Exact kubectl exec + psql/mysql commands with connection strings]

### Common Infra Procedures
[DB provisioning steps, cert rotation, scaling procedures — step by step]
```

---

## Section 5: On-Call Schedule & Expectations

```markdown
## On-Call Schedule & Expectations

**PagerDuty:** [Schedule Link](url)
Rotation switches [day] at [time].

**People in rotation:** [names]

### Hours & Response
- **Business hours ([times]):** [expectations — respond to pages, monitor dashboards]
- **Off-hours:** [expectations — best-effort next morning, or 30-min response for P1]

### Daily Responsibilities
- Check PagerDuty for alerts
- Monitor [dashboards]
- Respond in [#help-channel]

### Weekly Responsibilities
- Post on-call summary to [#ops-channel]
- Review and update this runbook

### Additional Duties
- [e.g., release manager for the week — see Release & Deployment]
```

---

## Section 6: Alert Sources & Configuration

```markdown
## Alert Sources & Configuration

One row per alert, not per tool. "Configured In" names the exact object that holds the threshold, and "How to Change" names the path a change takes, so whoever edits the alert knows this row exists.

| Alert | Source | Configured In | How to Change | Action |
|-------|--------|---------------|---------------|--------|
| API error rate > 5% | Honeycomb | [Trigger "api-error-rate"](url) (not in repo) | Honeycomb UI → Triggers | Check SRE board |
| New unhandled exception | Sentry | [Sentry Alert Rule "new-issue"](url) | Sentry UI → Alerts | Check issue, correlate with deploys |
| Pod restart loop | Kubernetes | Probe in chart/templates/api-deployment.yaml; thresholds in chart/values.yaml | PR to the Helm chart | kubectl get events, check logs |
| Paging routing | PagerDuty | [PagerDuty Service](url) escalation policy | PagerDuty UI, service owner | Follow triage steps |
| p99 latency > 2s | Prometheus | PrometheusRule `api-latency` in deploy/alerts.yaml | PR to the alerts file | Check latency dashboard |
| Build/deploy failure | CI/CD | .github/workflows/deploy.yml | PR to the workflow | Check pipeline, investigate |
| [Custom] | [source] | [exact object] | [change path] | [action] |

### Kubernetes Probe Alarms
| Component | Liveness | Readiness | Time to Restart |
|-----------|----------|-----------|-----------------|
| API | /health/ | /health/ready | 30s (3 × 10s) |
| Worker | /health/live | /health/ready | 30s (3 × 10s) |
| Scheduler | /health/live | /health/ready | 30s (3 × 10s) |

### Anti-Drift
- Each row points at the system of record for that alert's threshold and the path to change it; the runbook never copies the threshold itself
- When changing alerts: update this table
- Weekly review: check that fired alerts are documented here
- Quarterly audit: compare PagerDuty/Prometheus/Sentry/Honeycomb configs against this table
- See anti-drift-checklist.md for full audit procedure
```

---

## Section 7: Alert Triage & Response

```markdown
## Alert Triage & Response

### First Steps (Any Alert)
1. Check health endpoints
2. Check [Sentry] for new/spiking errors
3. Check [Honeycomb] boards for anomalies
4. Check pod status: `kubectl get pods`

### Severity
| Severity | Response Time | Escalation |
|----------|--------------|------------|
| P1-P2 | Immediate (business hours) | Auto-escalates after [N] hours |
| P3-P5 | Best-effort same day | No auto-escalation |

### [Alert Type 1]: [Description]
1. [Step-by-step triage specific to this alert]
2. [What to check]
3. [When to escalate]
```

---

## Section 8: Troubleshooting Playbooks

```markdown
## Troubleshooting Playbooks

### [Failure Pattern Name]
- **Symptoms:** [What the on-call engineer observes]
- **Likely cause:** [Most common root cause]
- **Investigation:** [Specific commands and checks]
- **Resolution:** [How to fix; who to escalate to]

### [Failure Pattern Name]
- **Symptoms:** [...]
- **Likely cause:** [Distinguish "never worked" vs. "suddenly broken"]
- **Investigation:** [...]
- **Resolution:** [...]
```

---

## Section 9: Incident Management & Communication

```markdown
## Incident Management & Communication

### Channel Routing
| Channel | Use For |
|---------|---------|
| #help-[service] | User-facing: bug reports, user questions |
| #proj-[service]-ops | All alarms, SRE discussion (@ mention — most have muted) |
| #proj-[service]-[partner] | Escalation to partner teams |
| #proj-[service]-core | Planning only — NOT incidents |

### Outages: Declare an Incident
1. [How to declare: PagerDuty incident, Slack incident bot command, or manual]
2. Create or join the incident channel; name an incident commander (IC)
3. Post status updates every [N] minutes in the incident channel
4. After resolution: write the PIR; corrective actions become tracked issues

### Communication to Users
- **Outages:** [Status Page](url) ([Component]) — update on declare, on change, and on resolve
- **Maintenance:** [Maintenance banner system](url)
- **Non-outage bugs:** Post directly in #help-[service]
```

---

## Section 10: Escalation Paths

```markdown
## Escalation Paths

| Situation | Action |
|-----------|--------|
| P1/P2 not resolved in [N] hours | Standard PagerDuty escalation, or @ mention [person] in #ops channel |
| Need SRE help | @ mention in #proj-[service]-ops |
| [Partner] issue | Post in #proj-[service]-[partner] |
| Specific integration issue | Use support channel from Infrastructure table |
```

---

## Section 11: Release & Deployment

```markdown
## Release & Deployment

### Schedule
**Every [day] at [time].** The on-call engineer is the release manager.

### QA Phase (Morning)
1. Run full test suite: `[command]`
2. QA on UAT: [what to test, specific workflows to run]
3. Fix any bugs found
4. Compile changelog: [command or skill]

### Release
- [Command for feature release]
- [Command for hotfix]
- [What the CI/CD pipeline does]

### Deadline Rules
- **Missed [time]:** Can push a few hours
- **Reached [late time]:** Notify team, delay to next day
- **Deploying after [late time] (optional, not recommended):** At your own risk; must monitor for issues

### Post-Release Checks
- [Exact verification steps — same as UAT qualification]

### Rollback
| Method | When |
|--------|------|
| Automatic | [e.g., Helm rollback on deploy failure] |
| Manual (preferred) | [e.g., re-trigger previous pipeline] |
| Emergency | [e.g., kubectl rollout undo] |
```

---

## Section 12: Tooling

```markdown
## Tooling

### [Tool Category] (e.g., Claude Code Skills)
| Tool | Use For |
|------|---------|
| /[skill-1] | [description] |
| /[skill-2] | [description] |

### Example Usage
[2-3 examples showing how to invoke tools for common on-call tasks]
```

---

## Section 13: Alert Misses

```markdown
## Alert Misses

Track incidents that don't trigger PagerDuty alerts: [Alert Misses Doc](url)

Alert misses receive **dedicated fix time** during on-call — they are not best-effort. Misses compound over time and cause real pain if left unaddressed.
```
