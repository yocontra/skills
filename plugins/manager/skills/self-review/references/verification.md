# Verification — every claim and every number

A self-review lives or dies on trust. One hallucinated detail — a
language the user never wrote, a team they never worked with, a number
that's off — makes a reviewer doubt the whole thing. Run this pass
before showing a finished draft, and be adversarial: assume each
impressive claim is wrong until a source proves it.

## Claims: trace or cut

Every factual statement must trace to one of:
- a project doc (design doc, RFC, one-pager),
- a project README,
- the PR crawl,
- the weekly status rollup,
- or a direct user statement.

If it traces to nothing, cut it and tell the user why. Do not soften a
guess into a hedge and keep it — remove it.

### Common traps

Check for these by name:

- **Wrong language or tech.** A project's stack guessed from its name
  instead of read from its README. Read the README; state the stack
  from the source, not the name.
- **Aspirational partnerships stated as done.** "Team X was eager to
  adopt it" is not "we onboarded Team X." Only claim collaborations
  that actually happened.
- **Too-minor work dressed up as achievement.** A small speedup or a
  handful of bug fixes framed as a headline. If the user says it's
  minor, it's out and stays out.
- **Inflated scale.** A throughput or adoption number stated larger
  than reality. Get the real figure or state none.

## Numbers: recount, don't trust summaries

- **PR counts:** recount **merged only**, per month, with the search
  API (`is:merged`, `total_count`). Sum the months and cross-check the
  total. Agent-reported counts drift — a per-month agent undercounted
  its own window in practice. The API total is the source of truth.
- **Opened vs merged:** "opened" inflates over "merged." Use merged; a
  reviewer can't argue with merged.
- **User-provided figures** (jobs/day, active teams, adoption): keep
  them, but label each "confirm this is current" for the user. Never
  launder an unverified figure into a stated fact. These change month
  to month; the user knows the live number.

## Wording rules

- **"Created," not "invented."** Also avoid "pioneered," "revolutionized."
- **No self-assigned rating.** Any rating the form asks for is
  the user's call. Leave it blank; note which categories the evidence
  supports if asked, but never choose.
- **Attribute honestly.** "Worked with security to get through
  approval" not "I got us approved" when it was a team effort. "Helped
  <name> get <project> off the ground" when it was support, not
  ownership.
- **Manager tenure is honest.** A few months of managing is early.
  Don't imply a long track record; frame it as the start and let the
  user add specifics.

## Minor-work filter

Cut from the log and narrative: small bug fixes, refactors, test-only
changes, dependency bumps, CI fixes, one-line changes, doc typo passes,
icon/library swaps. Translate clusters of small PRs into the capability
they add up to, or drop them. When in doubt, cut it and list it in the
closing batch's "too minor?" question.

## Final gate

Before delivering (Step 6), confirm:
- [ ] Every project, language, and partner team traces to a source.
- [ ] Every number is either API-verified or labeled for user confirmation.
- [ ] No self-assigned rating.
- [ ] "Created" not "invented"; attributions honest.
- [ ] No em dashes, no buzzwords (that's the humanizer pass, but check).
