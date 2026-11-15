---
name: uplift
effort: medium
description: 'Make any repo agent-ready: audit CLIs, auth, MCP, env vars, settings.json permissions, CI, CLAUDE.md; then apply CLAUDE.md/AGENTS.md, scoped permissions, hooks, MCP config, dev-loop commands, setup docs (--report: read-only). Never installs, logs in, or prints secrets. Triggers: "agent-ready", "uplift", "preflight".'
---

$ARGUMENTS

# Agent-ready uplift

Take any repo on macOS or Linux and make it something an agent can pick up cold: audit
what an agent would need, report how ready the repo is, plan concrete changes, apply
them, and report what changed. It assumes no cloud, forge, company, or internal
tooling; every finding is gated on evidence in the repo.

Flow: **Audit** (read-only) → **Report** → **Plan** → **Apply** → **Re-check** →
**Cleanup**.

## Contract

- **Audit, Report and Plan change nothing.** No writes to the repo, the home directory,
  or any settings file, and no installer, login, context switch, or other command that
  changes machine state.
- **Report-only runs stop after Plan.** That is `--report`, `--quick`, `--json`, or any
  request for "just a report" / "only check". The plan appears in the report as text;
  nothing is written. Every other run applies the plan without asking.
- **Apply writes only the plan's items, only inside the repo.** Never the user's home
  directory or global settings. Edit existing files by merging (keep every line the
  project wrote); never delete or overwrite a line the project wrote. Do not commit:
  leave the changes in the working tree, and show the diffs in the final summary.
- **Machine-state fixes stay with the user.** Installs, logins, `use-context`, and
  starting services are listed as exact commands for the user to run, never run here.
- **Secrets by presence only.** Never print, echo, or write a secret value. Read
  `~/.npmrc`, `~/.docker/config.json`, `~/.claude.json`, `.mcp.json` for key names only.
  New config refers to secrets through environment variables, never literals.

## Exit checklist

Keep this current. A turn that ends with an item open is a progress report, not the end.

- [ ] Audit: scan ran (or every dimension is `UNKNOWN` with its probe command)
- [ ] Verify: every requirement has exactly one row, or is listed under `GAPS`
- [ ] Report emitted, with the numbered uplift plan
- [ ] Plan applied (skip under report-only modes), with any assumptions stated
- [ ] Re-check: each applied item and each user-reported fix re-probed with evidence
- [ ] Self-check passed
- [ ] Cleanup: temp dirs removed, no probe or background process left running, every
      verify agent or workflow finished or stopped
- [ ] Final summary: what changed (`git status --short` and the diffs), assumptions made,
      what the user still has to do

## Arguments and modes

`$ARGUMENTS` is any mix of a path (default: cwd) and flags.

| Flag | Trigger phrases | Behavior |
|---|---|---|
| (default) | "make this agent-ready", "uplift this repo" | Audit, report, plan, apply, re-check |
| `--report` | "just a report", "is this agent-ready?", "preflight" | Audit, report, plan as text; change nothing |
| `--quick` | "quick check", "just CLIs and auth" | Tooling, Auth, Sandbox permission only; report-only |
| `--service <name>` | "check sentry", "uplift for kube" | Only rows that mention the name; a `NOT_INTEGRATED` row for it becomes a blocker |
| `--no-prompt` | "no questions", called by another agent | No `AskUserQuestion`; open questions take their default or stay as observed |
| `--json` | "parseable", "give me JSON" | JSON per [report-schema.md](references/report-schema.md); implies `--report --no-prompt` |
| `--verbose` | "show everything" | Include single-evidence `RECOMMEND` rows |
| `--weighted` | "weighted score" | Weighted rubric (weights in report-schema.md) |

The report always leads with:

```
VERDICT: READY | BLOCKED | DEGRADED
BLOCKERS: <int> | WARNINGS: <int>
GAPS: <int>
```

## Time budget

State the expected wall-clock before fanning out: about 2 minutes, plus a minute per 16
requirements. Record `START=$(date +%s)` and put `elapsed Ns / budget Ns` in each verify
agent's prompt. The budget is advisory; the 5-second per-probe timeout still applies. At
2x the budget with agents still running, use what has returned and list the rest as
`GAPS`.

## Fast path: audit as a workflow

When the `Workflow` tool is available, run the audit (inventory and verify) as a
workflow. Report, Plan and Apply stay here, because the workflow cannot call
`AskUserQuestion`.

1. Resolve scope here: the root path, plus a file list if the user narrowed it.
2. Read `${CLAUDE_PLUGIN_ROOT}/skills/uplift/uplift.config.json` and merge
   `scope: { rootDescription, files, constrained }` into it.
3. State the budget, then launch:

   ```
   Workflow({
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/uplift/uplift.js",
     args: {
       ...<merged config>,
       pluginRoot: "${CLAUDE_PLUGIN_ROOT}",
       promptsDir: "${CLAUDE_PLUGIN_ROOT}/workflows/uplift/prompts",
       mode: "<text|json>",
       flags: { quick: <bool>, service: "<name|null>" },
       verifyModel: "<model, optional>"
     }
   })
   ```

   **Cost.** Verify runs one agent per requirement at `effort: low`, up to 16 at a time,
   so spend scales with the requirement count; `--quick` and `--service` shrink it. Pass
   `verifyModel: "sonnet"` (or `"haiku"`) for a large repo: a cheaper model forfeits
   prompt-cache sharing with this session, which is the right trade at many agents.

   Verify agents do not inherit `${CLAUDE_PLUGIN_ROOT}`. If it does not expand, resolve
   it with `echo "${CLAUDE_PLUGIN_ROOT}"` and pass the absolute path.
4. The workflow returns `{ inventory, probe_results, coverage_gaps, mode }`. Each
   `coverage_gaps` entry goes on the `GAPS:` line, never into the warning count.

Without the `Workflow` tool, run Phase 1 directly; the result is the same.

## Phase 1: Audit

### Inventory

Run the deterministic scan first. It is read-only and replaces about 20 ad-hoc file
checks; do not repeat its work with `cat`, `ls`, or `grep` over the same paths.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/scan-project.py" "<project-root>"
```

The schema is in the script's docstring. If the scan cannot run, keep the full breadth:
report every dimension below as `UNKNOWN` with the probe that would verify it. A user who
names one symptom still gets every dimension; the symptom sets the order, not the scope.

| Scan field | Requirement |
|---|---|
| `host.os`, `host.shell` | Picks the install command and timeout wrapper for every remediation |
| `manifests.*`, `toolchain_versions`, `dev_loop`, CI steps | Tooling (CLIs on PATH, version pins) and Dev loop (setup, build, test, lint, run) |
| `git.remote`, `ci.providers` | Auth for the forge, and one CI row per provider |
| `claude.mcp_servers`, `claude.enabled_plugins` | MCP and Plugin rows |
| `claude.permissions`, `claude.hook_events` | Sandbox permission rows (broad rules, `defaultMode`, deny rules) and hook rows |
| `env_files.env_var_names` | Env rows (names only) |
| `manifests.*.private_index` / `private_registry`, `containers.registries` | Dependency install and Container registry |
| `evidence.service_hosts`, manifests | Service component and External service integrations |
| `evidence.sibling_paths` | Sibling repo rows |
| `kube_helm`, `deploy_topology` | Cluster correctness, only past its Step 0 gate |
| `claude_md.*`, `claude.project_skills` | Agent doc (12-item rubric, Model currency) and Project skills |
| `gitignore.*` | Agent artifacts (`.claude/settings.local.json`, `CLAUDE.local.md`) ignored |

Then apply the [plugin recommendation map](references/plugin-evidence-map.md): emit
`RECOMMEND` for each marketplace plugin the evidence implies and
`claude.enabled_plugins` lacks. Run user-level skill discovery once here (the scoped
`find` in [probes.md](references/probes.md)) so verify agents never repeat it.

Record each requirement as `{category, name, evidence (scan field or file:line), blocker}`.

### Verify

Run the matching probe from [probes.md](references/probes.md) for every requirement, in
parallel. A requirement with no documented probe is `UNKNOWN`; do not invent one. Probes
are POSIX `sh` capped at 5 seconds (see [shell-portability.md](references/shell-portability.md)).
A timeout is `UNKNOWN`, never `OK` or `MISSING`. Each probe emits one row:

```json
{ "category": "...", "name": "...", "status": "OK|STALE|UNAUTH|MISSING|NOT_INTEGRATED|RECOMMEND|WARN|WEAK|UNKNOWN",
  "probe_command": "...", "evidence": "...", "remediation": "..." }
```

Probes keep output in shell variables. If one needs a scratch file, create and remove it
inside the same Bash call, since shell state does not persist between calls, and never
write scratch files into the project tree:

```bash
tmp=$(mktemp -d "${TMPDIR:-/tmp}/uplift.XXXXXX") && trap 'rm -rf "$tmp"' EXIT INT TERM
```

## Phase 2: Report

Emit the report per [report-schema.md](references/report-schema.md): verdict header,
rows grouped by category, rubric score. Resolve what the repo can answer with a default
and state it as an assumption: of two candidate test commands, the one CI runs; a
sibling repo path, the checkout found next to this one. Ask only when no default exists
and the answers would produce materially different changes, such as the cluster mapping
in [probes.md](references/probes.md): one question per item, batched into as few
`AskUserQuestion` calls as possible (up to 4 questions per call, at most 4 options each).
Under `--no-prompt` the row stays as observed.

## Phase 3: Plan

Turn every failing, `WEAK`, `WARN`, and `RECOMMEND` row into a numbered uplift plan, using
[uplift-changes.md](references/uplift-changes.md) for what each change contains. Each
item names the file, whether it is new or an edit, the rows it fixes, and a one-line
summary. Typical items, each only when the audit shows the gap:

1. `CLAUDE.md` (or `AGENTS.md` if the repo already uses it) from the template, or the
   missing sections of an existing one, or stale model ids in it.
2. `.claude/settings.json` permissions: scoped allow rules for the repo's real, verified
   dev-loop commands; deny rules for `.env*` and secret files; recommended plugins.
3. Hooks: format and lint on edit, using the repo's own formatter and linter.
4. `.mcp.json` for services the repo already integrates with, secrets via env vars.
5. Runnable dev-loop commands: a `make`/`just`/`package.json` target for test, lint,
   build, or run when the repo has the steps but no single command.
6. Setup docs: the steps to get from clone to a passing test run.
7. `.gitignore` entries for agent artifacts.

List machine-state fixes (installs, logins, context switches) separately, as commands for
the user. In report-only modes, stop here. Otherwise go straight to Apply; do not ask.

## Phase 4: Apply

For each plan item, in plan order:

- Create the file, or merge into the existing one. For JSON, parse and merge keys; never
  drop existing keys or rules. For Markdown, add missing sections; keep what is there.
- Before adding a permission rule or hook, run the command once (capped, read-only where
  possible) and check that it exists and works. A command that fails today gets no rule or
  hook; report the item as skipped, with the error.
- Never add `Bash(*)`, bare `Bash`, or `defaultMode: bypassPermissions`.
- Show `git diff --stat` and the diff of each edited existing file after writing.

## Phase 5: Re-check

Re-run the probe behind every row an applied item or a user-reported fix touched, and quote
its output before flipping the row to `OK`; a claim is not evidence. A blocker the user
skips becomes `SKIPPED` with a note that the capability will fail.

## Self-check

Before the final report:

- Every `OK` row cites the probe command and a positive evidence string, not just exit 0.
- Every blocker has a fix or plan item, and every item references a row by `Category.Name`.
- `STALE` rows name declared and observed values; `WEAK` rows name rubric gaps by number;
  `RECOMMEND` rows name evidence and the exact `enabledPlugins` line.
- No file outside the plan's items changed (`git status --short` matches the plan).
- `VERDICT` matches the counts: `READY` needs zero blockers and zero gaps.

A false `OK` propagates to every agent that trusts the verdict. When a probe is
indeterminate, the status is `UNKNOWN`. Never reuse a previous run's results.

## Cleanup

- Remove any scratch directory this run created; confirm no `"${TMPDIR:-/tmp}"/uplift.*`
  from this run remains.
- Kill any probe that outlived its cap. Uplift starts no long-running processes; if a
  check started a dev server to confirm a run command, stop it by PID.
- Every verify agent has returned or been stopped, and the workflow (if used) has finished.
- Touch nothing this run did not create or the plan did not edit.

## Orchestrator interface

Report only: `Agent({ description: "Agent-readiness audit", prompt: "Run /agent-ready:uplift /path/to/project --report --no-prompt" })`.
Apply: the same prompt without `--report`.

Decomposed: call the workflow directly with `{ scope, mode: "json", pluginRoot, promptsDir }`.
It returns `{ inventory, probe_results, coverage_gaps, mode }`; the caller owns
presentation and any apply step.
