# Categorization rules

Each unified event gets exactly one category. Assign it with the
discrimination guide below; the sections define each category.

## Outage

A *production* service was unavailable or significantly degraded for
*customers* (internal or external — count both).

Requires a filed record of customer impact (any one):
- An incident at a customer-facing severity on a team service: an
  incident-labeled issue or a record in the named incident tool. Use
  the team's own severity scale; when it is unknown, assume Sev 1–2 (or
  P0–P1) means customer-facing.
- A status-page outage or degraded-performance entry for a team
  service.

A rollback or revert that cites customer impact but has no such record
is a Regression (guide step 3).

Edge cases:
- An internal-only incident (often Sev 3 or lower) is **not** an outage. Probably
  a regression or near miss.
- A pager that turned out to be a false alarm is **not** an outage.
  Drop it unless an incident was filed.

## Regression

A defect was introduced by a recent change but did not reach
production customers. Examples: caught in staging, caught behind a
flag, reverted before exposure, surfaced in CI.

Signals (any one):
- A merged PR was reverted within 7 days, with no associated
  customer-facing incident.
- An issue created with priority P1/P2 + label `regression` linked
  to a recent merge.
- A deploy rollback that completed before a release went customer-wide.

Edge case: a regression that reached customers briefly with no
incident filed stays a Regression (see the guide below).

## Partial recovery

The outage was mitigated but the underlying defect remains latent —
i.e. another instance could happen. Common signs: rollback used as
the fix, no root-cause analysis completed, the linked issue is
still open weeks later.

Signals (any one):
- An incident is closed but the linked follow-up issue is
  still open ≥ 14 days later.
- The incident's "permanent fix" PR is still open or hasn't been
  filed.
- The post-incident review explicitly notes "we mitigated by X but
  haven't fixed Y."

This is the most informative category for the team's retro
discussion — partial recoveries quietly accumulate. Don't lump them
into Outage; the discussion is different.

## Near miss

An incident *was avoided* by a control catching the problem. The
team got lucky in a structured way and should know it.

Signals (any one):
- A canary deploy failed and prevented the change from rolling out
  wider.
- A pre-deploy check (lint, integration test, manual review) caught
  a defect that would have been customer-visible.
- A revert was filed before any deploy of the offending change.
- An issue labeled `regression` was filed before the change reached
  customers AND no incident was filed.

This category is often **the most interesting** to the retro. The
team avoided pain through a control; understanding which control
worked (and what's still load-bearing) is high-leverage.

## Discrimination guide

Walk this in order and stop at the first match:

1. Was an outage mitigated while its root cause is still open 14+ days
   later (follow-up issue open, permanent fix not merged)? →
   **Partial recovery**. This check comes first because it overrides
   Outage and Regression.
2. Was there customer-visible impact with an incident filed (an
   incident issue, a status-page entry, or the named incident tool)? →
   **Outage**.
3. Was there customer-visible impact, however brief, with no incident
   filed? → **Regression**. The incident filing is the disambiguator.
4. Was a defect reverted, rolled back, or fixed before customer
   impact? → **Regression**.
5. Did a control (canary, check, review) catch the problem before any
   defect shipped? → **Near miss**.
6. None of the above? → drop the entry; it is not retro material.

## Don't do

- **Don't downgrade based on team morale.** Categorization is
  descriptive, not evaluative.
- **Don't merge two outages just because they share a root cause.**
  Two customer-impacting events = two timeline entries; the Patterns
  section handles the shared-root observation.
- **Don't create entries for normal bug fixes** not tied to a deploy /
  revert / incident.

## Example assignments

| Event | Category |
|-------|----------|
| Sev 2 — payment service down 12 min, fixed by rollback, follow-up issue still open | Partial recovery |
| Sev 3 — internal search reindex failed, rolled forward with patch, customers unaffected | Regression |
| Sev 1 — auth service down 35 min, full RCA published, all follow-ups closed | Outage |
| Canary failed on the job scheduler, change reverted, no further attempt | Near miss |
| PR #1234 reverted within 6 hours, no incident filed, change was internal-only | Regression |
| Deploy rollback rolled production back to prior version after metrics dropped | Outage if an incident was filed for it, else Regression |
