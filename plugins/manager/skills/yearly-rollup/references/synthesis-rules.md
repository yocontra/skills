# Synthesis rules — finding themes in a year of artifacts

A theme is a pattern that explains a chunk of the year. The skill's
job is to find them, not invent them.

## What a theme is (and isn't)

| Theme | Not a theme |
|-------|-------------|
| "Replaced Foo with Bar over Q1-Q2" — multiple PRs, multiple weeks, several people, customer-visible at end | "Shipped PR #1234" — single project, single artifact |
| "Hardened on-call across the year" — incident counts dropped from 12 → 3, multiple alerting/runbook PRs, a rotation reorg | "On-call was busy in March" — single event |
| "New capability: <X>" — a new hire brought a skill the team didn't have; that capability now shows up across the year's work | "<Person> joined the team" — onboarding event |
| "Driving down operational toil" — multiple automation PRs over the year, measurable hours saved | "Built one automation script" — single PR |

A theme spans:
- ≥ 4 weeks of activity
- ≥ 5 related artifacts (PRs, issues, incidents, status entries)
- typically ≥ 2 people contributing

## How to find themes

### 1. Cluster artifacts by topic

For each PR / issue / status entry, extract title, repo/component,
linked artifacts, and people. Cluster by:

- **Title keywords** — recurring phrases ("search indexer," "build cache,"
  "migration to Foo")
- **Component / repo** — multiple PRs in the same repo over months
- **Cross-references** — chains of linked artifacts
- **Milestones, projects, and labels** — a GitHub milestone or project
  board that stays active for months, or a label shared across repos,
  is often a theme the team already named

Filter clusters for "≥ 4 weeks span" and "≥ 5 artifacts."

### 2. Look for inflection points

Themes often have a before/after. Look for sharp changes in commit
volume, incident frequency, or vocabulary that map to a clear date
(new hire, departure, milestone). The cause of the inflection is
probably a theme.

### 3. Look for cross-cutting work

Some themes don't cluster around a component — "improving developer
experience," "reducing on-call load," "supporting <other team>'s push."
These show up in cross-team review/incident/issue data.

### 4. Look at what the team itself called out

If a weekly status archive exists, scan its highlights. Phrases that
recur month over month are likely themes the team already named.

## Naming themes

A theme name should be **descriptive, specific, past-tense**.
"Replaced Foo with Bar" beats "Modernizing our infrastructure";
"Search indexer rebuild" beats "Infrastructure work."

Avoid buzzwords ("Operational excellence"), names that don't say what
was done, and names that overlap with another theme — merge them.

## Theme count guidance

- 4 themes for a small team / quiet year
- 5-6 for a typical 6-12 person team in a normal year
- 7 only if there's genuinely 7+ distinct year-spanning patterns

If the data only supports 3 themes, write 3 themes. Don't pad.

If you have 10 candidate themes, merge until you're at 7 or fewer.
Things to merge:
- Two themes that share a root cause ("incident response" + "post-
  incident follow-through" → "Hardening incident response")
- Two themes that share the same group of people doing the same
  kind of work in different areas
- Themes where one is a subtheme of the other

## What evidence each theme needs

For every theme to land in the doc, it needs:

1. **A name** that describes what happened.
2. **A motivation paragraph** — why did this work matter?
3. **A work paragraph** — what got built / changed, with named
   projects and named people.
4. **An outcome line** — where did the team land at year end?

If you can't write a defensible outcome line for a theme, the data
doesn't support it. Drop or merge.

## Per-IC content vs Theme content

- **Themes** describe the year's *work*, with people cited as evidence.
- **Per-IC** describes each *person's* year, with work cited as evidence.

They overlap (the same PR shows up in both). That's fine — different
readers want different things. Tighten prose so neither bloats; don't
try to deduplicate.

## Numbers section checks

Before any number lands in the table:

- Verify against the source data; don't trust agent pre-summaries blindly.
- Exclude bot authors (the team-list recipe drops `[bot]` accounts).
- Note caveats inline if a number misleads ("Merged PRs: 1,234
  (excludes auto-version-bumps from foo-bot)").

A confidently wrong number poisons the whole doc.

## What to do if the year was thin

Some years are maintenance, between arcs, or reorg-disrupted. Reflect
that honestly: 3 themes is fine, the Summary names the consolidation
arc, the Gaps section gets longer. Don't fabricate themes to fill space.
