# Recon: map a project for a documentation-staleness audit

You are mapping a project so the downstream finders know exactly what is in scope and where to look for stale documentation.

The wrapper inlines the target ROOT and SCOPE above this prompt — read those parameters, then map the target accordingly.

## Steps

1. **Identify structure** — read build files, entry points, directory layout.
2. **Discover documentation surfaces** — search for all of these:
   - Doc directories (`docs/`, `doc/`, `documentation/`, `wiki/`, `guides/`)
   - README files at any depth (`**/README*`, `**/readme*`)
   - Skills/plugins (`**/skills/`, `**/plugins/`, `**/.claude/`, `**/SKILL.md`)
   - Config files with descriptions (`*.yaml`, `*.yml`, `*.toml`, `*.json` with human-readable descriptions or comments)
   - Changelogs (`CHANGELOG*`, `CHANGES*`, `HISTORY*`)
   - Contributing guides (`CONTRIBUTING*`)
   - API docs (OpenAPI specs, generated doc folders)
   - Inline doc systems (docstrings, JSDoc, rustdoc, godoc)
3. **List all in-scope source files** — Glob for relevant extensions.
4. **Identify natural boundaries** — packages, modules, features, layers.
5. **Note doc-heavy areas** — areas with lots of comments or documentation are priority targets.

## Output

Return:
- `summary` — recon notes plus the full list of discovered documentation surfaces, at most 400 words. Finders rely on this.
- `files` — all in-scope files. Always include the documentation surfaces.
- Put the natural module, feature, and layer boundaries in `summary` too. The schema has no separate field for them.

## Triage variant

If the SCOPE parameter instructs "TRIAGE PASS", read only the first ~50 lines of each provided file and classify risk; return only the high-risk files in `highRisk` and explain in `summary` what made them high-risk.
