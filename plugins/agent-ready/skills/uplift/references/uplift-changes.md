# Uplift changes

What each uplift plan item contains. Plan an item only when an audit row shows the
gap, and fill it from the repo's evidence, never from assumptions about the stack.

## 1. CLAUDE.md or AGENTS.md

- If neither exists, create `CLAUDE.md` from [claude-md-template.md](claude-md-template.md).
  If the repo already has `AGENTS.md` (or a team convention for it), edit that instead;
  do not create both. A one-line `CLAUDE.md` containing `@AGENTS.md` is enough when other
  agents read `AGENTS.md`.
- Fill only sections the scan supports: Quick Commands from `dev_loop` verbatim, CI
  pointer from `ci.providers`, Related Repos from sibling evidence. A section with no
  evidence stays `<TODO>` and is listed in the final summary.
- For an existing doc, add the missing rubric sections (by number, from the `WEAK` row)
  and keep every project-written line.
- Model currency: replace stale model ids and rejected parameters using the `claude-api`
  skill's current ids and migration mapping, never from memory. Change only those lines.

## 2. `.claude/settings.json` permissions and plugins

Merge into the existing file; create it with only these keys if absent.

```json
{
  "permissions": {
    "allow": ["Bash(make test:*)", "Bash(npm run lint:*)", "Bash(git status:*)", "Bash(git diff:*)"],
    "deny": ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)"]
  },
  "enabledPlugins": { "gh@skills": true }
}
```

- Allow rules cover only the repo's own dev-loop commands that ran successfully in the
  audit, plus read-only git. Use the narrowest prefix that works.
- Deny rules cover secret files that exist (`.env*`, key files, credentials dirs).
- Never add `Bash(*)`, bare `Bash`, `Write` without a path, or
  `defaultMode: bypassPermissions`. Flag existing ones as `WARN` and plan scoped rules.
- `enabledPlugins` lines come from `RECOMMEND` rows only. Use the marketplace name the
  user installed this plugin from (`claude plugin marketplace list`); `skills`
  above is a placeholder. Also merge that marketplace into `extraKnownMarketplaces`
  (for example `"skills": { "source": { "source": "github", "repo": "yocontra/skills" } }`,
  with the source `claude plugin marketplace list` shows), or a teammate who has not
  added the marketplace gets nothing from the `enabledPlugins` line.
- Personal preferences go in `.claude/settings.local.json`, which stays untracked.

## 3. Hooks (format and lint)

Only when the repo has a formatter or linter config and its command ran cleanly in the
audit. A `PostToolUse` hook on edits runs the formatter on the changed file:

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "jq -r '.tool_input.file_path' | xargs -r <formatter> >/dev/null 2>&1 || true" }] }
    ]
  }
}
```

Replace `<formatter>` with the repo's own (`npx prettier --write`, `ruff format`,
`gofmt -w`, `rustfmt`). Keep hooks fast (a single file, no full-repo lint); put full lint
in the dev loop instead. `jq` must be on PATH, or write the hook as a small script under
`.claude/hooks/`. Do not add a hook that fails or takes seconds today.

## 4. MCP config (`.mcp.json`)

Only for services the repo already integrates with (an `External service integrations`
row) and that publish an MCP server. Secrets through env var expansion:

```json
{ "mcpServers": { "<name>": { "type": "http", "url": "https://<host>/mcp",
                              "headers": { "Authorization": "Bearer ${<NAME>_TOKEN}" } } } }
```

Never write a literal token. Name the env var in the setup docs. Project servers need
approval on first use; say so in the summary.

## 5. Runnable dev-loop commands

When `dev_loop.test`, `lint`, `build`, or `run` is null but the steps exist (in CI YAML or
a README), add one entry point in the tool the repo already uses: a `Makefile` target, a
`package.json` script, a `justfile` recipe, or a `scripts/` file. Copy the steps from CI so
local and CI agree. Run the new command once and confirm it works before reporting it.

## 6. Setup docs

The shortest path from clone to a passing test run: prerequisites with versions (from
`.tool-versions`, `.nvmrc`, `pyproject.toml`), install, env vars by name (from
`.env.example`), first test command. Put it in the Development Environment section of
`CLAUDE.md`, or in the README if the repo keeps setup there. Do not duplicate it.

## 7. `.gitignore` for agent artifacts

Append only missing lines:

```
.claude/settings.local.json
CLAUDE.local.md
```

If the uplift added a scratch or output directory convention, ignore it too. If
`.claude/settings.local.json` is already tracked, tell the user to run
`git rm --cached .claude/settings.local.json`; do not run it.

## After applying

Re-run the probes for every row the items touched. Final summary: `git status --short`,
items applied, items skipped, `<TODO>` sections left, and commands the user must run.
