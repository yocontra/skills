# Anti-Drift Checklist

Use this checklist to audit an existing runbook for accuracy. Run quarterly or whenever a significant operational change happens.

**Priority key:** Items marked (P1) break incident response if wrong. (P2) cause confusion. (P3) cosmetic/minor.

---

## Automated Checks (run first — 5 minutes)

These can be scripted or run by a Claude Code agent:

- [ ] (P1) All Quick Links table URLs return 200 (not 404/403/redirect loops)
- [ ] (P2) Health endpoint curl examples succeed against prod
- [ ] (P2) Commands in code blocks parse correctly (no typos, paths exist)
- [ ] (P3) All Slack channel names resolve (haven't been renamed/archived)

```bash
# Check every masked link in the runbook; print only the ones that fail
grep -oE '\]\(https?://[^) ]+\)' docs/runbook.md | sed -E 's/^\]\(|\)$//g' | sort -u |
while read -r url; do
  code=$(curl -s -o /dev/null -m 10 -L -w "%{http_code}" "$url")
  [ "$code" = 200 ] || echo "$code $url"
done
```

---

## Human Review — Critical (P1)

These require judgment and directly impact incident response:

- [ ] Escalation contacts are still on the team and in their roles
- [ ] PagerDuty auto-escalation path matches runbook
- [ ] On-call rotation list matches PagerDuty schedule
- [ ] Alert inventory table matches what's actually configured in PagerDuty/Sentry/Honeycomb
- [ ] Rollback commands still work with current infrastructure
- [ ] Kubernetes probe endpoints match deployed helm chart
- [ ] Incident-tool and status-page service registration is correct

## Human Review — Important (P2)

These cause confusion or waste time:

- [ ] Release commands (`make deploy-*`) still exist and work
- [ ] QA steps match current testing requirements
- [ ] Architecture dependency tree matches current service dependencies
- [ ] Cascading failure scenarios still accurate
- [ ] Channel routing table matches current team norms
- [ ] Integration support channels still active and staffed
- [ ] Time-to-restart calculations match current probe intervals/thresholds

## Human Review — Maintenance (P3)

These are cosmetic or slow-drift items:

- [ ] People in rotation list is current
- [ ] Release schedule (day/time) hasn't changed
- [ ] Tooling section lists current skills/tools
- [ ] No dead links in body text (not just Quick Links table)
- [ ] "Last audited" date at top of runbook is updated

---

## Incident-Driven Checks

After every significant incident, verify:

- [ ] The failure pattern IS in a troubleshooting playbook (add if missing)
- [ ] The playbook's "likely cause" and "resolution" matched reality
- [ ] Any new escalation path discovered is documented
- [ ] Any new alert that SHOULD have fired is tracked in Alert Misses

---

## Quarterly Deep Dive

Beyond the checklist above:

- [ ] Check last 3 months of high-severity issues and PIRs — any new patterns not covered?
- [ ] Check Sentry for recurring error categories not in playbooks
- [ ] Cross-reference alert configs in external systems against the inventory table
- [ ] Verify no new dependencies added that aren't in the architecture section
- [ ] Check if team membership changed (new hires needing onboarding, departures)
- [ ] Verify secrets/credential rotation policies still documented if applicable
- [ ] Confirm support hours haven't changed

---

## How to Run This Audit

1. Open the runbook side-by-side with this checklist
2. Run automated checks first (link validation, command parsing)
3. Work through P1 items — these are non-negotiable
4. Spot-check P2 items (all if time permits, at least half)
5. Fix findings immediately rather than tracking them as TODOs
6. Update "Last audited" date at the top of the runbook
7. Note any systemic issues (e.g., "we keep getting this wrong") for process improvement

**Estimated time:** 20 minutes automated + 30 minutes human review for a well-maintained runbook. 2+ hours for one that hasn't been audited in 6+ months.

**Who runs it:** The on-call engineer during a quiet week, or explicitly scheduled quarterly.
