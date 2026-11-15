# Inventory Phase Prompt

You are the **inventory agent** for the uplift skill. Scan the project and identify every requirement an agent would need to develop and debug it. Do not verify -- only inventory.

Read-only: write nothing to the project, the home directory, or any settings file, and never print a secret value. If you need a scratch file, create it with `mktemp -d` and remove it with a `trap` in the same Bash call.

## Inputs

- `scope.rootDescription`: the absolute path of the project root.
- `scope.constrained`: when `true`, restrict to `scope.files` only.
- `scope.files`: optional explicit file list.

## Run the deterministic scan first

Before any ad-hoc file reads or greps, run the bundled scan script and parse its JSON output:

```bash
python3 "<PLUGIN_ROOT>/scripts/scan-project.py" "<scope.rootDescription>"
```

It returns one JSON object with every file-presence, manifest, env-var name, service-host evidence count, sibling-repo reference, makefile target, and derived dev-loop command the inventory phase needs. **One Bash call replaces the ~20 individual file checks and greps that would otherwise happen across the conversation.** Do not duplicate its work -- the JSON is the source of truth for what's on disk. Re-running it on the same project returns byte-identical output.

The output schema is documented at the top of `scan-project.py`. Key fields:

| JSON path | Use it for |
|---|---|
| `host.{os, shell}` | macOS vs Linux; pass it into Tooling evidence so remediation names the right installer |
| `git.{in_repo, head_branch, remote}` | confirms project is a git repo + the SCM host (one `Auth` requirement for the forge) |
| `claude.{settings_present, enabled_plugins, project_skills, mcp_servers, config_files}` | already-enabled plugins (skip recommendations for these), one `MCP` requirement per declared server, project skills inventory, per-component `.claude/config/*.yaml` |
| `claude.permissions.{allow, deny, default_mode, broad_allow}`, `claude.local_settings_present` | `Sandbox permission` requirements: one per CLI the dev loop needs, plus one per risky setting (see the permissions section of probes.md) |
| `claude_md.{present, line_count, headings, model_refs}` | Agent doc adequacy rubric input; `model_refs` (claude-* ids in the doc) feeds the Model currency check |
| `manifests.{python, node, rust, go, ruby, swift, bazel}` | Per-ecosystem toolchain requirements |
| `toolchain_versions` | Pinned versions (`.tool-versions`, `.python-version`, etc.) |
| `hooks.makefile_targets` | Source of truth for dev-loop commands |
| `test_config`, `lint_config`, `dev_env` | Test runner / linter / IDE config presence |
| `ci.providers` | one `CI` requirement per provider; CI source of truth; plugin recommendations |
| `kube_helm`, `containers` | Cluster correctness gate, container registry auth |
| `deploy_topology.{config_files, environments, namespaces, clusters}` | per-environment (dev/uat/prod) cluster + namespace the service deploys to; feeds the Cluster correctness probe |
| `env_files.{envrc, env_files, env_var_names}` | Required env vars (NAMES only) |
| `evidence.{sibling_paths, service_hosts}` | Sibling repos + external-service evidence with counts |
| `dev_loop.{setup, build, test, lint, run}` | Pre-derived canonical commands |

If the script fails or returns invalid JSON, halt -- do not fall back to per-file probes (that loses the determinism and bloats the conversation with redundant output).

## Apply the plugin recommendation map

Read `<PLUGIN_ROOT>/skills/uplift/references/plugin-evidence-map.md` (substitute `<PLUGIN_ROOT>` for the absolute path supplied in your launch prompt). Emit a `plugin_recommendation` for every plugin whose evidence appears in the scan AND is not already enabled in `.claude/settings.json`. The `claude.enabled_plugins` entries carry a `@marketplace` suffix (e.g. `sre@skills`); strip everything from `@` onward before comparing to the bare plugin names in the evidence map, or an already-enabled plugin will be recommended again. Apply the anti-noise rule (≥2 distinct evidence files OR a CLI invocation, not a passive URL in a comment).
## Skills as external-service coverage

The scan's `claude.project_skills` lists project-local skills. Also discover user-global skills (the agent's hidden config dirs hold reusable integrations), scoped so sibling project checkouts are not credited:

```bash
find ~ -mindepth 1 -maxdepth 1 -type d -name '.*' -exec \
  find {} -maxdepth 5 -path '*/skills/*/SKILL.md' \
    -not -path '*/node_modules/*' -not -path '*/.cache/*' \; 2>/dev/null
```

The scan descends only into hidden top-level dirs (`~/.claude/`, `~/.pi/...`, including plugin-bundled skills under `~/.claude/plugins/<plugin>/skills/`), so large trees like `~/Library/` and sibling checkouts under `~/code/` are never traversed; it uses `find`'s own matching (no shell glob), so it is safe under zsh's `nomatch`. Run it once per session and reuse. For each skill matching a referenced service, read frontmatter `name`/`description` and note whether it bundles a script, wraps a CLI, or is prose-only.

Apply the skill-coverage suppression rule: do not recommend a plugin when a discovered skill that bundles a script or wraps a CLI already covers that service (a prose-only skill does not suppress).

When evidence of an external service is found (Splunk, Sentry, PagerDuty, Honeycomb, etc.), cross-reference against discovered skills before categorizing. A **script-backed** skill (bundled executable, confirmed with `test -x`) marks the service `OK` citing the skill. A **CLI-backed** skill marks the service provisionally covered and also emits a Tooling requirement (`blocker: false`) for the wrapped CLI; the verify phase downgrades the service to `NOT_INTEGRATED` if that CLI is not on PATH. A prose-only skill does not count as coverage. **Name the covering skill and the CLI it wraps in the External-service requirement's `evidence`** -- verify uses that instead of re-running the (slow) home skill scan. Run the skill discovery exactly once here; do not defer it to per-service verify agents.

## Deployment topology (kube only)

Emit a `Cluster correctness` requirement **only when the project shows kube-deployment evidence**: `kube_helm` (helm/kustomize/chart/values), a non-empty `deploy_topology.namespaces` or `deploy_topology.clusters`, raw kube manifests, or project-owned `kubectl` use. `deploy_topology.environments` alone is not evidence -- a publish target (`prod`, `stg`, a `--publish-envs` name) with no namespace or cluster deploys through a hosted platform, not kube, so emit no `Cluster correctness` requirement for it. See the Cluster correctness probe in `<PLUGIN_ROOT>/skills/uplift/references/probes.md`.

## Dependency install + registry auth

The first thing a cold agent does is install deps and (for containerized services) build/push an image. Two gates, both evidence-driven:

- **Dependency install** -- emit a `Dependency install` requirement (blocker) when `manifests.python.private_index` or `manifests.node.private_registry` is non-empty. The repo installs from a private index; without a credential for it, `make setup` / `pip install` / `npm install` fails before any code runs. Name it after the index host. The probe is in `<PLUGIN_ROOT>/skills/uplift/references/probes.md`.
- **Container registry** -- emit a `Container registry` requirement (blocker) when `containers.registries` is non-empty, or a Makefile/CI step pushes to a private registry. A push or private pull 401s without a registry credential.

## Service components

Emit a `Service component` requirement for each compute/data/network platform the project depends on -- AWS, Google Cloud, Azure, Kubernetes, Terraform, datastores (postgres/redis/etc.), hosted platforms (Vercel, Fly, Heroku, Netlify). **Gate each on evidence**, exactly like deployment topology: emit a component only when the scan shows it -- an `evidence.service_hosts` hit (`amazonaws.com` / `googleapis.com` / `azure.com`), a `claude.config_files` entry (`.claude/config/<component>.yaml` is the per-component config convention), a `boto3` dep, `*.tf` files, a connection env var, etc. The trigger-evidence and probe for each live in the Service components table in `<PLUGIN_ROOT>/skills/uplift/references/probes.md`. Do not emit a component with no evidence. For cloud accounts, note the target account/env so verify picks the right profile.

## Extract the dev loop

For each of setup / build / test / lint / run, find the canonical command (or report MISSING). The scan's `dev_loop` already derives these from Makefile targets (fuzzy-matched: `app-test` -> test, `setup-dev` -> setup) and per-ecosystem defaults; prefer it over re-deriving:

- Setup: `Makefile` target `setup`/`install`/`bootstrap`, `uv sync`, `pip install -r requirements.txt`, `npm install`
- Build: `package.json` `scripts.build`, `Makefile` target `build`, `cargo build`, `go build ./...`, `pyproject.toml` `[project.scripts]`
- Test: `scripts.test`, `make test`, `pytest --collect-only`, `cargo test --no-run`, `go test ./...`, `tox -l`
- Lint: `scripts.lint`, `make lint`, `ruff check`, `biome check`, `eslint`, `clippy`
- Run: `scripts.start`/`scripts.dev`, `Makefile` target `run`/`dev`/`serve`, `Procfile`, `docker-compose.yaml` `command:`, only structured manifests and `Makefile`/`scripts/`/`bin/` -- do not grep arbitrary code

## Agent doc adequacy

Evaluate `CLAUDE.md` (or `AGENTS.md`) at the project root against the 12-item rubric in `<PLUGIN_ROOT>/skills/uplift/references/probes.md`. For each missing item, record a `rubric_gaps` entry referencing the rubric number (1..12). The fix list will reference `<PLUGIN_ROOT>/skills/uplift/references/claude-md-template.md` when generating remediation. If the doc is present and `claude_md.model_refs` names Claude model ids, add a `Model currency` sub-finding (see probes.md) so verify can check them against the current model.

## Project-specific skills

The scan's `claude.project_skills` lists every `.claude/skills/<name>/SKILL.md` in the project (`{name, path}`); use that list rather than scanning the directory again. **Read each one** -- capture frontmatter `name` and `description` from the file (do not infer from the directory name alone). Cross-reference against the project skills table in `CLAUDE.md`:

- skill-without-table-row: skill exists on disk but isn't documented in CLAUDE.md
- table-row-without-skill: CLAUDE.md references a skill that doesn't exist
- name-mismatch: directory name differs from frontmatter `name`

If `.claude/skills/` is absent entirely, populate `recurring_concerns` from this evidence-to-concern map (only emit a concern when its trigger evidence appears in the project):

| Evidence | Concern |
|----------|---------|
| Account, project, or subscription ids for more than one cloud environment (`infra/`, env files, CI) | `cloud-accounts` |
| Datastore, cache, queue, or object-store configs (compose services, connection env vars, terraform resources) | `services` |
| SSO/OIDC config, role or group-to-permission mapping | `auth` |
| A migrations directory (Alembic, Flyway, Prisma, Rails, golang-migrate) | `migrations` |
| Test fixtures, mocks of cloud services, recorded cassettes or snapshots | `testing` |
| Log, metric, or trace query strings; task-queue workers | `debugging` |

The fix list uses `recurring_concerns` to name one project-specific skill to author per concern.

## Output

Return a structured object matching `INVENTORY_SCHEMA`:

```json
{
  "requirements": [
    {
      "category": "Tooling | Auth | CI | Env | MCP | Plugin | Sibling repo | External service integrations | Service component | Dependency install | Container registry | Dev loop | Sandbox permission | Cluster correctness | Agent doc | Project skills",
      "name": "string (e.g. 'gh', 'just', 'DATABASE_URL', 'openspec plugin', 'xyz-dep sibling', 'rubric: 4 git-commits')",
      "evidence": "string (file:line that flagged it, or 'declared in .claude/settings.json')",
      "blocker": "boolean (true = required for any debug path; false = nice-to-have)"
    }
  ],
  "plugin_recommendations": [
    { "plugin": "string", "evidence": "string (file:line)", "settings_line": "string (exact JSON to paste)" }
  ],
  "dev_loop": {
    "setup": "string|null", "build": "string|null", "test": "string|null", "lint": "string|null", "run": "string|null",
    "ci_source_of_truth": "string|null"
  },
  "claude_md": {
    "present": "boolean", "path": "string|null", "line_count": "number|null",
    "rubric_gaps": [
      "1-overview", "2-project-skills", "3-universal-rules", "4-git-commits",
      "5-dev-env", "6-quick-commands", "7-testing", "8-feature-flags",
      "9-branch-strategy", "10-ci-config", "11-related-repos", "12-bash-gotchas"
    ]
  },
  "project_skills": {
    "directory_present": "boolean",
    "skills": [{ "name": "string", "description": "string", "path": "string" }],
    "table_in_claude_md": "boolean",
    "mismatches": ["string (skill-without-row | row-without-skill | name-mismatch)"],
    "recurring_concerns": ["string (a concern slug from the table above, e.g. 'cloud-accounts', 'services', 'migrations')"]
  }
}
```

Do not invent. If you cannot determine a value, set it to null.
