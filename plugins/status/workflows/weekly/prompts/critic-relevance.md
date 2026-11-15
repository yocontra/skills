# Critic: Relevance

Apply the "would a manager care?" test to each bullet in the draft. The audience is a semi-technical manager doing upward reporting.

## What to flag

- **Chore-level / internal-only / too granular** bullets that should be dropped or merged. Examples: dep upgrades, version bumps, lint/format-only changes, isolated CI flake fixes, internal-only refactors with no behavioral change, doc formatting.
- **Release artifacts** — "Released vX.Y.Z", hotfix-version mentions, release-pipeline mechanics. The manager assumes we ship; flag for removal.
- **Self-inflicted regression fixes** — bugs introduced and fixed within the same window (e.g., upgrade caused a break, this week we fixed it). Cleaning up your own mess is not status. Flag.
- **Internal plumbing wired between services** — auth-token forwarding, env-var pinning, image-build tweaks, issuer URL fixes, internal config corrections — unless the bullet names a user-visible outcome.
<!-- vale Skills.Wordiness = NO -->
- Any bullet that is **too long**, has subordinate clauses, or reads like a sentence rather than a one-line item. Strip "so that", "which means", "in order to" tails.
<!-- vale Skills.Wordiness = YES -->
- Any **editorializing** — phrases like "major UX win", "huge improvement", "important fix", "significant", "long-awaited", "exciting", "big deal", "critical" — these grade the change instead of stating it and must be removed. If a bullet only sounds notable because of the editorial phrase, the change probably isn't notable enough to include.
- **PR titles or commit subjects copied verbatim** — bullets shaped like `fix(api): ...`, `feat(runner): ...`, `chore(...)`, or anything with a Conventional-Commit prefix or `path/to/file:` colon are engineer-facing strings, not status. Flag for rewriting at the user/platform-outcome level, or for removal if the underlying change has no manager-visible outcome.
- **Bullets that restate a PR title instead of its impact** — the primary defect to hunt. `Skills bundled into the tarball at build time` says what the diff did; it never says why anyone should care. Flag any bullet a reader cannot finish the sentence "...which means users can now ___" or "...which stopped ___ from happening" for.
- **Meaningless-to-a-manager abstractions** — `A workflow is now a real container for its child resources` names an internal model change with no stated consequence. Flag it; either the consequence gets stated or the bullet goes.
- **Two unrelated things joined by "and"** — `Issue triage bot, and workflow.yaml is now the source of truth for prod workflows` is two items sharing a line because they shared a PR. Split or drop.
- **Author sections padded with small items** — flag chore-level and single-fix bullets that sit alongside major work. Bullet budgets scale with volume (see analyze-author.md), but every bullet must clear the impact bar on its own; a heavy week earns more bullets, not lower standards.

## Relevance criteria

A bullet passes if it:
- Names a user-visible or platform-visible change (feature, fix, capability, perf win, deprecation).
- Reads as a single noun phrase or short clause; no editorializing adjectives.
- Would make sense to a senior leader outside the team, without team jargon.

## Length tolerance

<!-- vale Skills.Wordiness = NO -->
Prefer one short line per bullet. A bullet that is **slightly above ~20 words** still passes — do not flag purely on length unless it has subordinate clauses or reads like a paragraph. Only flag length when the bullet has "so that", "which means", "in order to", or chains multiple clauses.
<!-- vale Skills.Wordiness = YES -->

## Examples

- Bad: "CLI accepts names or UUIDs across workspace, agent, and version commands — major UX win"
- Good: "CLI accepts names or UUIDs across workspace, agent, and version commands"
- Bad: "🐞 CI-only test failures from stale patch targets and autouse mock leak"  ← too granular
- Good: omit, or fold into a "test infra stabilization" themed bullet
- Edge (passes): "Reworked workspace allocator to support per-tenant quotas and live resize across all regions" — long but no editorializing, no subordinate tail.
- Edge (fails): "Reworked workspace allocator so that tenants can resize live, which means we no longer need downtime windows" — has "so that" and "which means" tails.

## Edge cases

- Bug-fix bullets for production-impacting issues always pass even if technical (e.g., "🐞 Fixed memory leak in ingest worker").
- A chore bullet passes if it had measurable user impact (e.g., "Upgraded TLS stack — unblocks FIPS compliance").
- Doc-only changes pass only if they ship external API documentation; internal doc tweaks fail.

## Output Schema

Return JSON: `{ "ok": <bool>, "problems": [<string>, ...] }`.

`ok=true` if all bullets are manager-relevant, terse, and free of editorializing. Otherwise list the offenders in `problems` — quote the offending bullet text and state why it fails.
