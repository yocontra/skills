# CLAUDE.md Template

Canonical structure for a project CLAUDE.md. Each section maps to one of the 12 rubric items in [probes.md](probes.md). When the uplift plan references this template, it identifies which sections are missing and tells the user (or a follow-up authoring agent) exactly what to write.

The skeleton below is filled in by the user or by an authoring agent. Uplift writes it (or the missing sections of an existing one) in Phase 4; in report-only modes it lists the missing sections without writing.

---

```markdown
# <Project> Development Guidelines

## Project Overview

**<Project>** (internally **<codename>** if applicable) is a <one-paragraph summary>. It runs on <infra summary>, deployed via <tool>.

| Layer          | Tech Stack |
| -------------- | ---------- |
| Backend        | <python/go/node + frameworks> |
| Frontend       | <react/vue/etc + bundler> |
| Tooling        | <uv, ruff, prek, pyenv> |
| Infrastructure | <pulumi/terraform, cloud and cluster targets> |
| Auth           | <oidc provider, sso, api keys, etc> |

### Deploy topology

<Only when the project deploys to kube. One row per environment (dev / uat / prod).>

| env  | namespace | cluster          | cloud account |
| ---- | --------- | ---------------- | ----------- |
| dev  | <ns>      | <cluster/region> | <acct id>   |
| prod | <ns>      | <cluster/region> | <acct id>   |

## Project Skills

Project-specific skills live in `.claude/skills/`. Reach for them by their trigger:

| Task | Skill |
| ---- | ----- |
| <recurring task A> | `skill-name-a` |
| <recurring task B> | `skill-name-b` |

Plugin-provided skills (`gh:*`, `sre:*`, etc.) are enabled via `.claude/settings.json`.

## Universal Rules

These apply to ALL code in the repository:

1. **<Rule>** -- <one-line elaboration>
2. ...

## Git Commits

<Repo-specific commit constraints: conventional-commit prefixes, CODEOWNERS gates, hooks that must pass.>

## Development Environment

```bash
<source venv/bin/activate, make setup, uv sync>
```

<Pinned tools, e.g. `uv` and `pyenv` are canonical; `pyproject.toml` and `uv.lock` are source of truth>

## Quick Commands

```bash
make format              # <linter set>
make run                 # <local stack>
make test                # <test suite>
make shell-db            # <psql/redis prompt>
```

<Frontend / mobile / other targets in their own subsections.>

## Testing

```bash
make test                # <full suite>
PYTEST_ADDOPTS="-v <path>" make test
PYTEST_ADDOPTS="-k <pattern>" make test
```

### Test Failure Investigation Rules

1. <"Never dismiss as environment-only without investigation.">
2. <"Investigate before categorizing.">
3. <"Every failure is a code bug until proven otherwise.">

## Feature Flags

<Only if the project uses env-driven flags. Otherwise omit.>

| Env var | Effect | Scope |
| ------- | ------ | ----- |
| `FF_<NAME>` | <behavior> | <per-env / per-user / per-tuning> |

## Branch Strategy

- Feature branches: `feature/<description>`.
- Default branch: `<dev/main>`.
- Production deploys from `<branch>`.

## CI Pipeline Configuration

- Pipeline config lives in `<.github/workflows/ci.yml | .gitlab-ci.yml | Jenkinsfile>`.
- Validate locally with `<actionlint | make ci-lint>`.

## Related Repos

### Sibling services

| Repo | Purpose |
| ---- | ------- |
| `<org/repo>` | <one-line> |

### Shared infrastructure

| Repo | Purpose |
| ---- | ------- |
| `<org/repo>` | <one-line> |

## Bash Scripting Notes

<Project-specific scripting gotchas. Examples:>

- **Checking command availability under pyenv:** `command -v foo` returns success even when the tool isn't installed (pyenv shims). Use `foo --version` to verify.
- **Capturing output under `set -e`:** `VAR=$(cmd)` exits immediately on `cmd` failure. Use `if ! VAR=$(cmd 2>&1); then ...` to handle errors.
```

---

## Style guidance

- Sections use `##` headers in the order above. Skip optional sections (Deploy topology, Feature Flags, Bash Scripting Notes) when they don't apply -- do not leave a placeholder section. Deploy topology is included only when the project has kube-deployment evidence (see the Cluster correctness probe gate).
- Tables use markdown table syntax with the columns shown. Keep one row per real item; do not invent placeholder rows.
- Every command in Quick Commands and Testing has a one-line `# comment` explaining what it does.
- Universal Rules and Test Failure Investigation Rules are numbered. Each rule has a bold name + a one-line explanation.
- Related Repos are split by relationship type (sibling / shared-infra / upstream-data) when the project has more than ~5 entries.

## What this template intentionally omits

- A `Status` / `What's next` / `Project Details` section. Those belong in commit messages or PLAN.md, not in a CLAUDE.md.
- Lead-in scaffolding ("This document...", "The following sections..."). Sections start with content immediately.
- Status badges, build badges. They rot and add noise.
- A "Contributing" section. CLAUDE.md is for the agent; contributing notes belong in `CONTRIBUTING.md` or the README.
