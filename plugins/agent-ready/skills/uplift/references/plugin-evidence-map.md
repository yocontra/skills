# Plugin Recommendation Map

Map evidence in the project to plugins from the marketplace. Emit a `RECOMMEND` row for every plugin the evidence implies but `.claude/settings.json` does not enable. Each row must cite the exact evidence (file:line) and the exact line to add to `.claude/settings.json`.

Recommend only plugins that exist in this marketplace: the table below. Never invent a plugin name.

| Evidence | Recommend plugin |
|----------|------------------|
| GitHub remote in `git.remote` (github.com or a GitHub Enterprise host), `github-actions` in `ci.providers`, `gh` in scripts | `gh` |
| Sentry DSNs or `sentry.properties`, Splunk queries, PagerDuty service ids, `runbooks/`, incident or PIR docs | `sre` |
| `openspec/` directory, `openspec` in scripts or docs | `openspec` (and `workflow`, which executes an approved `tasks.md`) |

## Output rules

A recommended plugin is `RECOMMEND` (warning, not blocker). Each row must include:

1. The evidence file:line that triggered it.
2. The exact JSON line to paste into `.claude/settings.json` `enabledPlugins`.

## Anti-noise

A single URL in a comment is weak signal. Default rules:

- Trigger `RECOMMEND` only when ≥2 distinct evidence files agree, OR
- the evidence is a CLI invocation (in `Makefile`, `scripts/`, `bin/`, or CI YAML), not a passive URL in a docstring.

Single-evidence findings get suppressed unless the user invokes `--verbose`.

## Skill coverage suppression

A plugin recommendation is noise when a skill already provides operational access to the same service. Discover skills with two scoped searches: user-global via `find ~ -mindepth 1 -maxdepth 1 -type d -name '.*' -exec find {} -maxdepth 5 -path '*/skills/*/SKILL.md' -not -path '*/node_modules/*' \;` (descends only into hidden config dirs, so sibling project checkouts and large trees like `~/Library/` are skipped), and project-local via `find <repo-root> -maxdepth 4 -path '*/skills/*/SKILL.md'`.

Suppress the `RECOMMEND` row when a discovered skill matching the service **bundles an executable script or wraps a system CLI** (e.g. a `sentry-cli`-wrapping skill covers the Sentry part of the `sre` plugin). A prose / knowledge-only skill does not suppress the recommendation (it teaches about the service but does not operate it). Suppression is silent: no row is emitted for the covered plugin.

## Plugins not in this map

Skill-only meta-plugins are intentionally absent because they are not project-specific:

- `humanizer` (writing), `manager` (manager workflows), `status` (standups), `agent-cost-report` (token spend)
- `audit`, `refine` (development workflows, not project bindings)
- `agent-ready` itself

Mention these at most once, in a closing line, and never as `RECOMMEND` rows.
