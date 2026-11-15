# Auth + Connectivity Probes

Each row defines an exact probe. Do not invent substitute commands. The `Positive evidence` column is what the agent must cite in the `OK` row -- exit code 0 alone is not sufficient (`gh auth status` exits 0 when the wrong host is loaded).

## Claude Code version (run this first)

```bash
claude --version
```

Positive evidence: a version string. Record it; the Model currency check uses it.

| Service | Probe | Positive evidence |
|---------|-------|-------------------|
| GitHub (`github.com` or the GitHub Enterprise host in `git.remote`) | `gh auth status -h <host>` | output contains `Logged in to <host>` AND the active account is the one the user expects for this repo |
| GitLab | `glab auth status` | output contains `Logged in to <host>` |
| Any git remote (Bitbucket, Gitea, self-hosted) | `GIT_TERMINAL_PROMPT=0 git ls-remote --exit-code origin HEAD` (5 s cap) | prints a ref; a credential prompt or 401 is `UNAUTH` |
| Kubernetes | `kubectl config current-context` then compare to expected (see Cluster correctness) | context name matches the cluster declared in this project's helm/kustomize config |
| Helm | `helm version --short` | output starts with `v` |
| Sentry MCP | `mcp__sentry__whoami` | response includes a user object |
| Other MCP servers (observability, docs, ticketing) | smallest read declared by each MCP server's tool list -- do not invent. If no probe is published, mark `UNKNOWN` rather than `OK`. | tool returned without auth error |

## CI provider

One `CI` row per entry in `ci.providers`. The question is whether the agent can read CI results for this repo, since that is how it confirms a push is green. Read-only probes only; never trigger, retry, or cancel a run.

| Provider | Probe | Positive evidence | No CLI or no auth |
|----------|-------|-------------------|-------------------|
| `github-actions` | `gh run list --limit 1 --json status,conclusion` | a JSON array (empty is fine on a new repo) | `UNAUTH` with `gh auth login`; covered by the `gh` plugin |
| `gitlab-ci` | `glab ci list --per-page 1` | a pipeline row or an empty list | `UNAUTH` with `glab auth login` |
| `circleci` | `circleci version` | a version string | `UNKNOWN`; results are read in the web UI or API |
| `buildkite` | `bk --version` | a version string | `UNKNOWN` |
| `azure-pipelines` | `az pipelines --help >/dev/null && az account show --query name` | an account name | `UNKNOWN` |
| `jenkins`, `bitbucket-pipelines`, `travis`, `drone` | none published | -- | `UNKNOWN`, evidence names the config file |

A local config linter (`actionlint`, `glab ci lint`, `circleci config validate`) is a `Tooling` row only when the project's own scripts or CLAUDE.md call it. Do not emit a separate CI-tool `MISSING` row when the forge CLI already covers the provider.

## Tooling on PATH

```bash
command -v <tool>           # gh, uv, node, docker, kubectl, helm, aws, terraform, ...
<tool> --version            # confirms it actually runs
```

The project names the tools it needs; uplift does not carry a fixed list. Sources, in order: the CLAUDE.md development-environment section, `.tool-versions` / `mise.toml`, Makefile and `package.json` scripts, CI workflow steps, and the CLIs enabled plugins wrap. When a tool is `MISSING`, route the remediation through the installer the project uses:

| Tool | Remediation |
|------|-------------|
| tools pinned in `.tool-versions` / `mise.toml` | `mise install` (or `asdf install`) -- not a global install |
| system CLIs (`gh`, `git`, `jq`, `kubectl`, `helm`, `terraform`, ...) | by `host.os`: `brew install <pkg>` on darwin; on linux the distro manager (`apt-get install`, `dnf install`, `pacman -S`) or the vendor's documented installer. Name the one the machine has (`command -v apt-get dnf pacman brew`). |
| Python CLIs the project lists as dev deps | `uv tool install <pkg>` or the project's own setup target |
| Node CLIs in `devDependencies` | `npm install` / `pnpm install` -- run through `npx`, not a global install |

If the project's version manager (`mise`, `asdf`, `pyenv`, `nvm`) is itself missing, every tool it pins has the wrong remediation. Surface the version manager as a top-level blocker first.

## Private package index (dependency install)

Gate: `manifests.python.private_index` or `manifests.node.private_registry` is non-empty -- the repo declares a package index other than public PyPI / npm. A repo with no private index emits no row.

A cold agent's first move is to install deps (`make setup`, `uv sync`, `npm install`). With a private index the machine cannot reach or auth to, that install fails before any code runs.

Probe credential presence, not a live install (the sandbox may block network):

1. Python: `pip config list` / `~/.config/pip/pip.conf` / `~/.netrc` / `UV_INDEX_*` env vars carry an entry for the index host. `uv` reads `UV_INDEX_<NAME>_USERNAME` / `_PASSWORD` or keyring.
2. Node: `~/.npmrc` has an `//<host>/:_authToken` line, or `NPM_TOKEN` is set when `.npmrc` references it.

Positive evidence: a credential entry (presence only, never the value) for the index host.

`MISSING` when the repo declares a private index and no credential for its host exists -- the dependency install will fail. Remediation: the login command the registry documents (e.g. `npm login --registry https://<host>/`); surface it, do not run it.

**Prefer `--index-url` over `--extra-index-url` for private Python indexes.** `--extra-index-url` lets pip pick a same-named package from public PyPI, which opens a dependency-confusion path. If a repo pins private packages through `--extra-index-url`, that is itself a finding -- flag it and recommend a single proxying index, or uv's explicit per-package `[tool.uv.sources]` index pinning.

## Container registry auth

Gate: `containers.registries` names a non-Docker-Hub registry, or a Makefile / CI step pushes to one. A repo that only builds locally (no push) and pulls public images emits no row.

`docker push <registry>/...` returns 401 without a registry credential. Probe credential presence (a live push is destructive and network-gated):

- `~/.docker/config.json` has an `auths` entry, or a `credHelpers` entry, for the registry host.

Positive evidence: an `auths` or `credHelpers` entry for the registry.

`MISSING` when the project pushes to or pulls from a private registry but no credential is present. Remediation: `docker login <registry>`, or the cloud helper (`aws ecr get-login-password ...`, `gcloud auth configure-docker <host>`); surface, do not run.

## Env vars

Only check presence, never print values. Use the shell-portable form documented in [shell-portability.md](shell-portability.md).

Check the names in `env_files.env_var_names` (from `.env.example`, `.envrc`, and similar) plus any the CI config or CLAUDE.md says local runs need. A name needed only in CI is `WARN`, not `MISSING`. When `.envrc` exists and `direnv` is the loader, a variable missing from the agent's shell may still load inside the project directory: probe with `direnv exec <root> printenv <NAME> >/dev/null` and report presence only.

## MCP servers

Declared servers come from `claude.mcp_servers` (project `.mcp.json`) and the `mcpServers` key names in `~/.claude.json` (user scope; read key names with a JSON parser, never print the file -- entries can hold tokens). Loaded servers are the `mcp__<server>__*` tools visible in this session.

- Declared and loaded, smallest read succeeds -> `OK`.
- Declared, not loaded -> `MISSING`. Remediation: `claude mcp list` run by the user shows the connection error. Uplift does not run it, because it starts every configured server.
- Loaded but its read returns an auth error -> `UNAUTH`.
- A project server that needs approval (`enableAllProjectMcpServers` / `enabledMcpjsonServers` unset) -> `WARN` naming the setting.

## Plugins

For each plugin listed in `.claude/settings.json` `enabledPlugins`, confirm the plugin's required CLIs/auth are also OK. A plugin whose backing tool is missing is itself a blocker -- the agent will be told to use it but cannot.

## Claude Code permissions allowlist

A CLI on PATH is not enough for an unattended run -- without a `permissions.allow` rule, every invocation stops for an approval prompt. Check these files in order:

1. `.claude/settings.json` -- project-level, committed to the repo (check this first)
2. `~/.claude/settings.json` -- user-level, persistent across sessions

A rule looks like `Bash(kubectl get:*)` or `Bash(gh pr view:*)`. Prefer read-only subcommand rules over a bare `Bash(kubectl:*)`.

Also flag risky configuration from `claude.permissions`, each as a `WARN` row (the user decides):

- `broad_allow` is non-empty (`Bash(*)`, bare `Bash`, `Write`) -- an unattended agent can run anything. Suggest scoped rules instead.
- `default_mode` is `bypassPermissions` in a committed `.claude/settings.json` -- every teammate inherits it.
- `deny` is zero while `.env` files exist -- suggest `Read(.env*)` in `permissions.deny`.
- `local_settings_present` and `.claude/settings.local.json` is tracked by git (`git ls-files --error-unmatch .claude/settings.local.json`) -- it is meant to stay personal.

For every CLI the project's dev loop or any enabled plugin requires (gh, kubectl, helm, docker, terraform, etc.):

- Allowed in project-level settings -> `OK`.
- Allowed only in user-level settings -> `WARN`. Works for you but teammates who clone the repo will be prompted. Remediation (an uplift plan item, applied in Phase 4, only for a command the audit ran successfully): add the rule to `.claude/settings.json` and commit it.
- Allowed in neither -> `MISSING` (blocker for unattended runs). Remediation (an uplift plan item, applied in Phase 4, only for a command the audit ran successfully): add `Bash(<binary> <read-only subcommand>:*)` to `.claude/settings.json` `permissions.allow`, or run `/permissions` to add it interactively.

## Cluster correctness (deployment topology: dev / uat / prod)

A single `current-context` check is not enough. When a project does deploy to kube, the agent needs to know **where this service lives in each environment** -- the cluster + namespace it deploys to in dev, uat/test, and prod -- to target the right place when reading logs, exec-ing a pod, or rolling a deploy. Gate first (Step 0); once a project is in scope, discover as much as the repo declares and interrogate the user for the rest. Do not stop at "no manifest found" -- but do not invent a kube dependency for a project that has none.

### Step 0 -- gate: does this project deploy to kube at all?

Run this probe (and especially its interrogation) **only when there is positive kube-deployment evidence**. Otherwise emit **zero** `Cluster correctness` rows -- do not ask the user anything, and do not flag a `current-context` mismatch (a stray context from another project is not this project's problem). A dimension with zero rows is omitted from the rubric, not scored `F`.

Kube-deployment evidence is **any** of:

- `kube_helm.{helm_dir, kustomization, chart_yaml}` true or `values_yaml_count > 0`,
- `deploy_topology.namespaces` or `deploy_topology.clusters` non-empty,
- raw kube manifests (a `kind: Deployment` / `Service` under `k8s/`, `manifests/`, `deploy/`),
- the project's own scripts invoke `kubectl` against a cluster it owns.

**`deploy_topology.environments` alone is not evidence.** A project can declare environments (`prod`, `stg`, a `--publish-envs` target) and deploy entirely through a hosted platform without ever touching a kube cluster the developer drives with `kubectl`. For such a project the environments are a CI concern, not a cluster-correctness one -- skip this probe.

### Step 1 -- discover from the repo (deterministic)

`scan-project.py` returns `deploy_topology`: the deploy-config files it found (`config_files`), plus the `environments`, `namespaces`, and `clusters` it extracted from them. Sources, in descending authority:

- **helm per-env values** (`values-<env>.yaml`): `namespace:` / `clusterName:` / `kubeContext:` keys, one file per environment.
- **kustomize overlays** (`overlays/<env>/`): the overlay directory name is the environment; `namespace:` lives in its `kustomization.yaml`.
- **CI deploy steps** (`.github/workflows/*.yml` and similar): environments often live in build-command flags (`--target-env stg`), which the scan captures as `environments`. Read the workflow directly to map each environment to its cluster when the scan's flat lists do not make the pairing obvious.
- **raw kube manifests** under `k8s/`, `deploy/`, `manifests/`.

Build a per-environment table: `{ env -> { cluster, namespace, source } }`. Leave a cell blank when the repo does not declare it -- that blank is what Step 2 interrogates.

### Step 2 -- interrogate for what is undiscovered

For each environment that has no declared cluster+namespace, ask **one question per environment** (dev, uat, prod), never one question covering several environments. Send them together in a single `AskUserQuestion` call (it takes up to 4 questions), batched with any other open questions from Phase 2:

> "Where does `<service>` deploy in **prod**? (cluster + namespace)"

Offer, as options: the Step-1 discovered value, candidates from `kubectl config get-contexts` whose name contains the service/repo name (e.g. repo `myservice` -> `myservice-prod`), and `Other`. When the repo declared no environments at all, assume dev / uat / prod, state that under Assumptions, and ask per environment; drop any environment the user says it does not deploy to. Cache answers for the rest of the session. When `--no-prompt` is set, do not ask -- emit each undiscovered cell as `UNKNOWN`.

### Step 3 -- compare the active context and emit rows

Ownership: a **declared cell** (namespace + cluster/region already in the requirement evidence) is resolved by the verify agent, which compares `current-context` and emits its own `OK`/`STALE` row -- the launcher does not re-emit it. This step is the **launcher's** path for cells it resolved in Step 2 (interrogation). Capture `kubectl config current-context` and `kubectl config get-clusters` (the merged kubeconfig's clusters). List `~/.kube/` for additional config files; users sometimes keep per-cluster kubeconfigs there and switch via `KUBECONFIG=~/.kube/<file>`. Emit **one row per environment the launcher owns** under `Cluster correctness` (exactly one row per environment total, across launcher + verify):

- `OK` -- environment's cluster+namespace is resolved (declared or user-confirmed) and a matching context exists.
- `STALE` -- the active `current-context` does not match the environment the user is working in; evidence names both (e.g. "current-context `prod-us-east`, prod is `prod-us-west`"). Remediation: `kubectl config use-context <expected>` (or `KUBECONFIG=~/.kube/<file>` when it lives in another file).
- `WARN` -- resolved but no kubeconfig context reaches that cluster.
- `UNKNOWN` -- undiscovered and `--no-prompt` suppressed the question.

Context names are kubeconfig-standard; cloud CLIs that write them include `aws eks update-kubeconfig` (EKS), `gcloud container clusters get-credentials` (GKE), `az aks get-credentials` (AKS), and `oc login` (OpenShift). Uplift only reads what they wrote -- it never calls them.

### Step 4 -- persist the mapping

A resolved topology is agent-doc evidence. When the dev/uat/prod -> cluster/namespace mapping was discovered or confirmed this session and `CLAUDE.md` does not already record it, surface a fix that adds a deployment table to the Project Overview / Infrastructure section (rubric item 1), so the next agent does not re-interrogate.

## Service components

Compute, data, and network platforms the project runs **on** (distinct from observability services it queries -- those are in External service integrations). Each is its own `Service component` row.

**Gate exactly like Cluster correctness: probe a component only when the project's evidence shows it depends on that component.** Do not run the AWS probe on a repo with no AWS evidence, do not run the Terraform probe without `*.tf` files, etc. A component with no evidence emits no row (and the zero-row dimension is omitted from the rubric, not scored `F`). The trigger-evidence column is what flips a component into scope. When a component is in scope but its CLI publishes no safe read-only check, the row is `UNKNOWN`, never `OK`.

| Component | Trigger evidence | Probe (read-only) | Positive evidence | Install if missing |
|-----------|------------------|-------------------|-------------------|--------------------|
| AWS | `boto3` / `@aws-sdk` dep; `amazonaws.com`; a 12-digit account id; `AWS_PROFILE` | `aws sts get-caller-identity --profile <name>` | returns `Account` + `Arn` for the expected account | AWS CLI v2 installer; auth via `aws sso login --profile <name>` or the project's documented method |
| Google Cloud | `googleapis.com`; `google-cloud-*` dep; `app.yaml` / `cloudbuild.yaml` | `gcloud auth list --filter=status:ACTIVE --format='value(account)'` then `gcloud config get-value project` | an active account and the expected project id | Google Cloud SDK; `gcloud auth login` |
| Azure | `azure.com`; `@azure/*` / `azure-*` dep; `azure-pipelines.yml` | `az account show --query '{name:name,id:id}'` | the expected subscription | Azure CLI; `az login` |
| Kubernetes | Cluster-correctness Step 0 evidence | `kubectl config current-context` | context resolves. Topology is the Cluster correctness probe. | `kubectl` from the OS package manager |
| Terraform / OpenTofu | `*.tf` files; `.terraform.lock.hcl` | `terraform version` (or `tofu version`) matching `required_version`; backend credentials per the provider row above | version satisfies the constraint | the version manager pin, else the OS package manager |
| Datastore (postgres / mysql / redis / ...) | a connection env var (`DATABASE_URL`, `PG*`, `REDIS_URL`, ...); a compose service | verify the **connection secret is provisioned**: env var present, or the secret manager entry the project documents. A live connect may be blocked by the sandbox network policy, so credential-presence is the probe, not a query. | secret/env present | provision the secret -- not a CLI install |
| Hosted platform (Vercel / Fly / Heroku / Netlify) | `vercel.json`, `fly.toml`, `Procfile` + `herokuapp.com`, `netlify.toml` | `vercel whoami` / `fly auth whoami` / `heroku auth:whoami` / `netlify status` | prints the current identity | the vendor's documented installer (`npx vercel`, `npx netlify-cli` avoid a global install) |

For cloud accounts specifically, pick the **right profile per environment** -- a repo that targets a prod account should be probed with that account's profile, not whatever profile is currently exported. When the token is expired, the remediation is interactive (`aws sso login`, `gcloud auth login`, `az login`); surface it, do not run it. This mirrors the per-environment treatment of Cluster correctness: cloud accounts, like kube, have dev/test/prod splits, and "authed to dev" does not mean "authed to prod".

## External service integrations

Distinct from plugin recommendations. Plugin recommendations ask *should the plugin be enabled?*; this asks *can the agent reach this service live right now?*. Only flag services whose data must be queried live (observability, error tracking, ticketing).

A service is covered when **either** an MCP is loaded for it **or** a skill provides operational access. Before emitting `NOT_INTEGRATED`, check for skill coverage.

### Skill-based coverage

**This discovery is an inventory-phase step, and it runs once.** The inventory agent runs the two `find` scans below one time, matches skills to services, and writes the covering skill (and the CLI it wraps) into each External-service requirement's evidence. A **verify agent must not re-run the `find ~` home scan** -- that scan can take many seconds and, run once per service, dominates the whole audit's wall-clock. The verify agent receives the covering skill + CLI in its requirement and only confirms the wrapped CLI is on PATH (`command -v <cli>`). Any single probe that would exceed a few seconds (a broad filesystem scan, a network call) must not run in verify; rely on the inventory evidence instead.

Discover skills via (inventory phase only):

```bash
# user-global skills: only descend into hidden config dirs (skips ~/Library, ~/code, ~/worktrees)
find ~ -mindepth 1 -maxdepth 1 -type d -name '.*' -exec \
  find {} -maxdepth 5 -path '*/skills/*/SKILL.md' \
    -not -path '*/node_modules/*' -not -path '*/.cache/*' \; 2>/dev/null
# project-local skills: substitute the absolute repo root for <repo-root>
find <repo-root> -maxdepth 4 -path '*/skills/*/SKILL.md' \
  -not -path '*/node_modules/*' 2>/dev/null
```

The home scan descends only into hidden top-level dirs (`~/.claude/`, `~/.pi/...`, `~/.config/...`, including plugin-bundled skills under `~/.claude/plugins/<plugin>/skills/`), so user-global skills are found while sibling project checkouts (`~/worktrees/...`, `~/code/...`) and large trees like `~/Library/` are never traversed. It uses `find`'s own `-name`/`-path` matching (no shell glob), so it is safe under zsh's `nomatch`. Run both once in inventory and reuse the result; never re-run per service or per verify agent.

Also check the project's own `.claude/skills/` directory and skills bundled by enabled plugins. For each discovered `SKILL.md`, read its frontmatter `name`/`description` and match against the service.

A skill only counts as **operational coverage** when it can actually query the service:

| Skill shape | Confirm | Result |
|-------------|---------|--------|
| Bundles an executable script (sibling file or `bin/` script, e.g. `splunk_query.py`, `sentry_api.py`) | `test -x <path>` | `OK` (evidence: "covered by skill `<name>` via `<script>`") |
| Wraps a system CLI (e.g. "use `sentry-cli`") | fall through to the Tooling probe for that CLI | depends on CLI probe |
| Prose / knowledge-only (no script, no CLI) | — | does not count; emit `NOT_INTEGRATED` |

- Splunk dashboard URL or `splunk` query in code, no MCP loaded, no script/CLI-backed skill -> `NOT_INTEGRATED`.
- Sentry project slug in `sentry.properties` or DSN in env, no MCP loaded, no covering skill -> `NOT_INTEGRATED`.
- Honeycomb dataset name or query in code, no MCP loaded, no covering skill -> `NOT_INTEGRATED`.
- Datadog / Grafana query strings in code or runbooks, no MCP loaded, no covering skill -> `NOT_INTEGRATED`.

Remediation for `NOT_INTEGRATED`: expose the service via a skill (the growing convention) or load an MCP, so the integration is discoverable and portable.

`NOT_INTEGRATED` is a warning by default, blocker only if the user invokes `--service <name>` for that service.

## Private sibling repos

Build an explicit list, not just path-string matches:

- Walk manifests for path-style deps: `pyproject.toml` `[tool.uv.sources]` / `[tool.poetry.dependencies]` `path = "../foo"`, `package.json` `"foo": "file:../foo"` or workspace deps, `Cargo.toml` `path = "../foo"`, `go.mod` `replace`, `Package.swift` `.package(path:)`, Bazel `local_repository(path = ...)`, pip `-e ../x` in `requirements*.txt`.
- Walk code/docs for explicit `~/Projects/<x>` / `../<x>` and dedupe against the manifest list.
- Classify each: `present at <path>`, `present at alternate <path>` (when multiple roots `~/Projects/`, `../`, `~/src/` are checked), `missing`.
- A missing sibling is a blocker by default. Use a present alternate path when one exists; otherwise the row stays `MISSING` with the clone command for the user.

## Agent doc adequacy

Check `CLAUDE.md` (or `AGENTS.md`) at the project root against this rubric. Items are numbered in the order they should appear in the document. Each missing section is a sub-finding under a single `Agent doc` row, and the fix references the canonical template at [claude-md-template.md](claude-md-template.md).

1. **Project overview** -- one-paragraph description of what the project is, plus a tech-stack table (Backend / Frontend / Tooling / Infrastructure / Auth), and (when the project deploys to kube) a deployment-cells table mapping each environment to its namespace / cluster / cloud account.
2. **Project skills** -- table of project-specific skills under `.claude/skills/<name>/SKILL.md`, each row pairing a task description with a skill name. Absence of any `.claude/skills/` directory is itself a sub-finding.
3. **Universal rules** -- numbered code-style invariants ("fail fast", "no Any", "DRY", "no manual retry loops", typing rules per language). Each rule on its own line.
4. **Git commits** -- repo-specific commit constraints (conventional-commit prefixes, CODEOWNERS gates, required checks).
5. **Development environment** -- canonical setup commands (`source venv/bin/activate`, `make setup`, `uv sync`) and pinned tools (uv, pyenv, prek versions).
6. **Quick commands** -- block of `make` / `npm` / `uv` targets, organized by purpose (run, test, lint, format, shell, clean). Each command has a one-line comment.
7. **Testing** -- how to run the suite, how to filter (`PYTEST_ADDOPTS`, `npm test -- --filter`), how to run a single test, and what "test failure investigation rules" the project enforces.
8. **Feature flags** (optional) -- only when `os.getenv("FF_*")` patterns or env-driven flag tables are observed in code. Table mapping env var to behavior, scope, and default.
9. **Branch strategy** -- default branch, deploy branch, feature-branch convention, hubflow / git-flow / trunk.
10. **CI config pointer** -- which file owns CI (`.github/workflows/*.yml`, `.gitlab-ci.yml`, `Jenkinsfile`) and how to validate it locally (`actionlint`, `gitlab-ci-lint`).
11. **Related repos** -- sibling services + shared-infra deps + upstream-data-feed repos. Each row pairs a repo name with one-line purpose.
12. **Bash scripting gotchas** (optional) -- only when shell scripts using `set -euo pipefail` are present. Project-specific notes (e.g. "`command -v foo` lies under pyenv shims; run `foo --version`").

Items 8 and 12 are conditional and emitted only when the project provides evidence for them. Items 1-7, 9-11 are always evaluated.

A `WEAK` row's evidence names every missing rubric item by number (e.g. "rubric: missing 2 (project skills), 4 (git commits), 7 (testing), 11 (related repos)"). A project with `CLAUDE.md` absent gets `WEAK` with all applicable items missing.

### Model currency (existing CLAUDE.md that won't work with the current model)

When `CLAUDE.md` (or `AGENTS.md`) is **present** and pins the agent to Claude models or model-specific API behavior, check that its guidance still works with the model this session runs (`claude --version`, and the running model id). `claude_md.model_refs` carries every `claude-*` id the doc names. Load the `claude-api` skill -- it is the source of truth for which ids are current, deprecated, or retired, and for the migration mapping. Emit a `STALE` sub-finding when the doc:

- names a **retired** model id (e.g. `claude-3-5-sonnet-*`, `claude-3-opus-*`, `claude-2*`) -- those 404 now, so any command or example that uses them fails, or
- names a **deprecated** id with a nearer current equivalent, or
- documents model behavior the current model rejects -- e.g. `budget_tokens`, `thinking: {type: "disabled"}`, forced `tool_choice` (`any` / `tool`), `temperature`/`top_p` on an adaptive-thinking model, or last-assistant-turn prefills. The `claude-api` skill says which of these the running model rejects.

Evidence names the stale id/parameter and the current replacement (e.g. "CLAUDE.md pins `claude-3-5-sonnet-20241022` (retired) -> <current Sonnet id from the claude-api skill>"). Remediation **updates the existing CLAUDE.md in place** (not a rewrite) -- an uplift plan item (see [uplift-changes.md](uplift-changes.md) section 1), applied in Phase 4, using the `claude-api` skill's migration guide. If the running model can't be determined, mark `UNKNOWN`, not `OK`.

## Project-specific skills (`.claude/skills/`)

Independent of the rubric, inventory the project's own skill library:

- List every `.claude/skills/<name>/SKILL.md` and capture each skill's frontmatter `name` and `description`.
- Cross-reference against the project skills table in `CLAUDE.md` -- each skill in `.claude/skills/` should appear in the table; each row in the table should resolve to a real `SKILL.md`.
- Mismatches (skill-without-table-row, table-row-without-skill, frontmatter-name-differs-from-directory-name) are sub-findings under a `Project skills` row.
- A project with no `.claude/skills/` is `WEAK`, never `OK` -- an absent desired artifact is a gap, not a passing probe. Suggest scaffolding skills for recurring needs the evidence shows (the concern table in the inventory prompt): cloud accounts -> `cloud-accounts`, datastores and queues -> `services`, migrations -> `migrations`, and so on. Each becomes an uplift plan item; author it in Phase 4.
