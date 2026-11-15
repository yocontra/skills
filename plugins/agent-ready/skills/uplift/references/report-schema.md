# Uplift Report Schema

The uplift audit's output is a fixed structure that downstream skills can parse. Two formats:

- **Text mode** (default): human-readable Markdown with the verdict block at the top.
- **JSON mode** (`--json`, implies `--report --no-prompt`): machine-readable. Same content, structured.

Both modes lead with the verdict block.

## Verdict block

```
VERDICT: READY | BLOCKED | DEGRADED
BLOCKERS: <int> | WARNINGS: <int>
GAPS: <int>
```

- `READY` -- zero blockers, zero gaps, zero or some warnings (still actionable).
- `DEGRADED` -- zero blockers, but one or more warnings or coverage gaps.
- `BLOCKED` -- one or more unresolved blockers after the interactive remediation pass.

`GAPS` counts probes whose verify agent never returned a result (the workflow's `coverage_gaps`). A gap is not a probe outcome -- the check did not run, so its status is genuinely unknown. Gaps are listed by `Category.Name`, never folded into the warning count, and a run with one or more gaps cannot report `READY` (the agent cannot vouch for what it never probed). Re-run, or scope with `--service`, to close them.

## Status enum

| Status | Meaning | Severity |
|--------|---------|----------|
| `OK` | probe ran and cited positive evidence | none |
| `STALE` | probe found expected/declared value, but observed value differs (e.g. wrong cluster context, toolchain version drift) | warning unless `--service` targets it |
| `UNAUTH` | probe ran but auth failed or expired | blocker |
| `MISSING` | required tool/file/env not present | blocker |
| `NOT_INTEGRATED` | external service referenced in code but no MCP loaded and no skill provides operational access | warning unless `--service` targets it |
| `RECOMMEND` | plugin should be enabled based on project evidence | warning |
| `WARN` | works for you but not committed for teammates (tool allowlisted at user level only, or env var needed only in CI) | warning |
| `WEAK` | agent-doc or rubric gap (CLAUDE.md absent / thin) | warning |
| `UNKNOWN` | probe could not run conclusively (timeout, no documented health check, indeterminate) | warning |
| `SKIPPED` | user explicitly chose `Skip` for this row in remediation | warning (with note) |

## Text-mode example

```
VERDICT: BLOCKED
BLOCKERS: 3 | WARNINGS: 5
GAPS: 0

Tooling
  gh                v2.62.0           OK
  uv                0.5.4             OK
  just              <missing>         MISSING (brew install just on darwin)
  kubectl           v1.30.2           OK

Toolchain versions
  python            3.12 (.python-version) matches local pyenv  OK
  node              20 (.nvmrc) but local is 18                 STALE (nvm use 20)

Auth
  github.com        ok (me, matches git user)                   OK
  npm @acme scope   401 from npm.acme.example                   UNAUTH (npm login --scope=@acme)

Sandbox permissions
  just test         in neither project nor user permissions.allow  MISSING
  broad rule        Bash(*) in .claude/settings.json               WARN (replace with scoped rules)

CI
  github-actions    gh run list returned the latest run            OK

Cluster correctness
  prod              myservice-prod @ prod-us-west (values-prod.yaml); current-context is prod-us-east  STALE
  uat               myservice-test @ test-us-west (overlays/uat)                             OK
  dev               namespace declared, cluster confirmed by user (dev-us-west)              OK

Dev loop
  build             make build                                  OK
  test              pytest -q                                   OK
  lint              ruff check .                                 OK
  run               <none found>                                MISSING -- agent has no canonical run command

MCP servers
  sentry            whoami returned user                        OK

External service integrations
  splunk dashboard referenced in runbooks/api.md                NOT_INTEGRATED (expose via skill or sre MCP)
  honeycomb dataset in code                                     NOT_INTEGRATED (expose via skill or sre MCP)

Env
  DATABASE_URL      set                                         OK
  NPM_TOKEN         <missing>                                   WARN (only needed in CI)

Sibling repos
  xyz-dep           ~/Projects/xyz-dep                          OK
  abc-dep           not found                                   MISSING (asked user; awaiting reply)

Plugins enabled
  audit             tools OK                                    OK
  gh                gh auth status OK                           OK

Plugins recommended (not yet enabled)
  openspec          evidence: openspec/ dir, Makefile:12           RECOMMEND
  sre               evidence: runbooks/api.md, splunk URL          RECOMMEND

Agent doc
  CLAUDE.md         present, 8 lines, no Quick Commands section    WEAK
                    (rubric: missing 5 (dev environment), 6 (quick commands), 7 (testing))

Remediation
  You run (uplift never changes machine state):
  1. brew install just && npm login --scope=@acme
  2. kubectl config use-context prod-us-west
  3. Provide a path to abc-dep (interactive)

Uplift plan (applied in Phase 4 unless --report):
  4. edit  .claude/settings.json   allow "Bash(just test:*)", deny "Read(./.env*)"
  5. edit  .claude/settings.json   enable openspec and sre plugins
  6. edit  CLAUDE.md               add Development Environment, Quick Commands, Testing
  7. new   Makefile target `run`   copied from the CI deploy-preview step
  8. edit  .gitignore              add .claude/settings.local.json

Rubric: D (66/100)
  Tooling                 3/4     75   C
  Auth                    1/2     50   F
  Sandbox permissions     1/2     25   F
  CI                      1/1    100   A
  Dev loop                3/4     75   C
  Cluster correctness     2/3     83   C
  Sibling repos           1/2     50   F
  Plugins enabled         2/2    100   A
  Plugins recommended     0/2     50   F
  Agent doc          0/1     50   F

Fixes (6; 2 auto-executable). See JSON `fixes[]` for the actionable form.
```

## JSON-mode schema

```json
{
  "verdict": "READY | BLOCKED | DEGRADED",
  "blockers": 0,
  "warnings": 0,
  "coverage_gaps": ["Category.Name (verify agent did not run)"],
  "rows": [
    {
      "category": "Tooling | Auth | CI | Dev loop | MCP servers | External service integrations | Service component | Dependency install | Container registry | Env | Sibling repos | Plugins enabled | Plugins recommended | Sandbox permissions | Cluster correctness | Agent doc",
      "name": "string",
      "status": "OK | STALE | UNAUTH | MISSING | NOT_INTEGRATED | RECOMMEND | WARN | WEAK | UNKNOWN | SKIPPED",
      "probe_command": "string (the actual command run)",
      "evidence": "string (positive evidence cited, or reason for non-OK status)",
      "remediation": "string (exact command or instruction; null when status is OK)"
    }
  ],
  "remediation": [
    "string (ordered list of next actions; human-readable mirror of fixes[])"
  ],
  "fixes": [
    {
      "id": "fix-001",
      "row_refs": ["Tooling.just", "Sandbox permissions.just test"],
      "priority": "blocker | warning",
      "description": "string (one-line summary)",
      "actions": [
        {
          "type": "shell | edit | prompt | manual | template",
          "command": "string (when type=shell; the exact command)",
          "interactive": false,
          "file": "string (when type=edit; the path to modify)",
          "operation": "string (when type=edit; e.g. append, replace, set)",
          "value": "any (when type=edit; the new value)",
          "question": "string (when type=prompt; the AskUserQuestion text)",
          "instructions": "string (when type=manual; what the user must do by hand)",
          "template": "string (when type=template; path to a references/*.md template)",
          "target": "string (when type=template; the file to create or replace)",
          "sections": "array<string> (when type=template; section headings to fill)",
          "fill_with": "object (when type=template; per-section guidance)"
        }
      ],
      "auto_executable": false,
      "blocks_apply": "string|null (precondition that must clear before this fix can run)"
    }
  ],
  "rubric": {
    "score": 74,
    "grade": "D",
    "dimensions": [
      { "name": "Tooling", "rows": 5, "weight": 1.0, "score": 100, "grade": "A" }
    ]
  }
}
```

`rows[].category` (and the `row_refs` in `fixes[]`) use the report's **display** labels: `Sandbox permissions`, `MCP servers`, `Plugins enabled` / `Plugins recommended`, `Sibling repos`, `Toolchain versions`. The verify agents emit the leaner machine categories from `inventory.md` / `verify.md` (`Sandbox permission`, `MCP`, `Plugin`, `Sibling repo`); the launcher relabels them in Phase 2 (Report) when assembling the report -- splitting `Plugin` rows into enabled vs recommended by status, and grouping toolchain-version `Tooling` rows under `Toolchain versions`.

Downstream skills parsing this should match on `verdict` (top-level) for go/no-go gating and `rows[].status` for per-row decisions. The `remediation` array is human-ordered; agents should not re-sort it. The `fixes` array carries the same content in a machine-actionable shape so a follow-up agent can iterate and apply.

## Rubric scoring

After all rows are emitted, compute a score per dimension and a single overall grade. Scoring is deterministic from row statuses -- no judgment.

**Per-row score:**

| Status | Score |
|--------|-------|
| `OK` | 1.0 |
| `STALE`, `WEAK`, `RECOMMEND`, `NOT_INTEGRATED`, `WARN`, `UNKNOWN`, `SKIPPED` | 0.5 |
| `MISSING`, `UNAUTH` | 0.0 |

**Per-dimension score:** mean of row scores in that dimension, multiplied by 100. A dimension with zero rows is omitted (not zero) -- it had nothing to evaluate. Coverage-gap rows (verify-agent failures, `_agent_failure: true`) are likewise excluded from the mean -- the probe never ran, so it neither passes nor earns the 0.5 a genuine `UNKNOWN` gets. They surface only on the `GAPS:` line.

**Overall score:** mean of per-dimension scores. Default unweighted; `--weighted` flag uses the weights below.

**Default weights** (when `--weighted` is set):

| Dimension | Weight | Reason |
|-----------|--------|--------|
| Auth | 2.0 | agent cannot reach any service without it |
| Tooling | 2.0 | agent cannot run anything without it |
| Sandbox permissions | 2.0 | binaries on PATH but blocked are equivalent to missing |
| CI | 1.5 | agent cannot confirm a push is green without reading CI |
| Dependency install | 2.0 | agent cannot install the project's own deps without access to its private package index -- nothing runs |
| Dev loop | 1.5 | agent cannot verify its own changes without it |
| Container registry | 1.5 | blocks the image build/push path (deploy) |
| Sibling repos | 1.5 | path-style deps that don't resolve break imports |
| Service component | 1.5 | agent cannot reach the compute/data plane the app runs on (AWS, GCP, Azure, a datastore) without it |
| Cluster correctness | 1.0 | per-environment, often catches at deploy time |
| MCP servers | 1.0 | per-debug-session, catches when invoked |
| External service integrations | 1.0 | warning-only; downstream debug failures |
| Env | 1.0 | per-secret, partial coverage common |
| Plugins enabled | 1.0 | already-enabled plugins are healthy or not |
| Plugins recommended | 0.5 | nice-to-have; agent can still operate |
| Agent doc | 1.0 | affects future agent runs more than this one |

**Grade mapping:**

| Score | Grade |
|-------|-------|
| 95-100 | A |
| 85-94 | B |
| 75-84 | C |
| 60-74 | D |
| 0-59 | F |

**Text-mode rubric block** (appended after `Remediation`):

```
Rubric: D (74/100)
  Tooling                 5/5    100   A
  Toolchain versions      1/2     50   F
  Auth                    3/3    100   A
  Sandbox permissions     2/3     67   D
  Dev loop                3/4     75   C
  MCP servers             3/3    100   A
  External service integrations  0/2    50   F
  Sibling repos           1/2     75   C
  Plugins enabled         2/2    100   A
  Plugins recommended     0/2     50   F
  Agent doc          0/1     50   F
```

The "rows" column is `OK + 0.5 * (warnings) / total`, rendered as `passing/total` of the integer-equivalent.

## Fix list

`fixes[]` is the machine-actionable mirror of `remediation[]`. Each entry references one or more rows it addresses and lists concrete actions. A follow-up agent or orchestrator can iterate this list and execute safe actions automatically, prompting only when an action's `type` is `prompt` or `manual` or when `auto_executable` is `false`.

**Action types:**

- `shell` -- a command to run. `interactive: true` means a TTY is required (e.g. `gh auth login`, `npm login`). Installs, logins and context switches are always for the user to run; uplift lists them and never runs them.
- `edit` -- modify a file inside the repo. `file` + `operation` (`append`, `replace`, `set`) + `value`. Settings.json merges, CLAUDE.md sections, `.gitignore` lines, Makefile targets. A `permissions.allow` edit names only scoped rules for commands verified in the audit (see [uplift-changes.md](uplift-changes.md)). Uplift applies every `edit` in Phase 4 unless the run is report-only.
- `prompt` -- ask the user something via `AskUserQuestion`. `question` is the literal text.
- `manual` -- the user must do this by hand (e.g. "ask the platform team to open egress to the artifact host"). `instructions` describes the steps.
- `template` -- author a file from a referenced template. `template` is a path to a `references/*.md` template file; `target` is the file to create or replace; `sections` is the list of section headings to fill (the template's full structure, narrowed to what the rubric flagged as missing). Used for CLAUDE.md.

## CLAUDE.md and project-skills fix scaffolding

When `Agent doc` is `WEAK`, the fix entry references the canonical template at [claude-md-template.md](claude-md-template.md) and lists exactly which rubric sections the project is missing. Example:

```
fix-NN  [warning]  Author CLAUDE.md from the template
        rows: Agent doc.rubric-gaps
        actions:
          - template:
              template: <PLUGIN_ROOT>/skills/uplift/references/claude-md-template.md
              target: ./CLAUDE.md
              sections:
                - "Project Overview"          # rubric 1
                - "Project Skills"            # rubric 2
                - "Universal Rules"           # rubric 3
                - "Git Commits"               # rubric 4
                - "Development Environment"   # rubric 5
                - "Quick Commands"            # rubric 6
                - "Testing"                   # rubric 7
                # rubric 8 (Feature Flags) omitted -- project has no FF_* env vars
                - "Branch Strategy"           # rubric 9
                - "CI Pipeline Configuration" # rubric 10
                - "Related Repos"             # rubric 11
                # rubric 12 (Bash Scripting Notes) omitted -- no shell scripts use set -euo pipefail
              fill_with:
                Project Overview: derive from README.md, pyproject.toml, infrastructure files
                Quick Commands: pull from Makefile targets verbatim
                CI Pipeline Configuration: pull .github/workflows/*.yml / .gitlab-ci.yml / Jenkinsfile as found
                Related Repos: extract from sibling-repo evidence in inventory.requirements
        auto_executable: false
        blocks_apply: null
```

When `Project skills` is `WEAK` (no `.claude/skills/` directory or table mismatches), the fix lists the skills to author for the project's recurring concerns observed during inventory. Uplift has no skill template and does not invent skill content, so this is a `manual` action; a table mismatch in an existing CLAUDE.md is an `edit`:

```
fix-NN  [warning]  Project skills to author for recurring concerns
        rows: Project skills.directory_present, Project skills.recurring_concerns
        actions:
          - manual:
              instructions: "Author .claude/skills/<concern>/SKILL.md for each recurring concern (cloud-accounts, services, migrations), with the concrete commands the repo uses."
        auto_executable: false
```

Uplift applies `edit` and `template` actions itself in Phase 4, for every plan item. In report-only modes they stay in the report for the user or another agent to apply.

**Ordering:** `fixes[]` is dependency-ordered. A fix's `blocks_apply` field names the precondition (the id of another fix that must run first). Apply runs in order, skipping fixes whose preconditions are not yet `OK`.

**Auto-executable rule:** `auto_executable: true` means every action in this fix is either an `edit` or a non-interactive `shell` command that changes no machine state, AND the fix has no `prompt` / `manual` actions. Installs, logins and context switches (`use-context`) are machine state, so a fix carrying one is always `false`. Anything else is `false`.

**Text-mode fix block** (appended after `Rubric`):

```
Fixes (5; 1 auto-executable):
  fix-001  [blocker]  Install just and log in to the private npm scope
           rows: Tooling.just, Auth.npm @acme scope
           actions:
             - shell: brew install just
             - shell: npm login --scope=@acme                         (interactive)
           auto_executable: false  (machine state; the user runs these)

  fix-002  [blocker]  Switch kubectl to project's expected cluster
           rows: Cluster correctness
           actions:
             - shell: kubectl config use-context prod-us-west
           auto_executable: false  (machine state; the user runs this)

  fix-003  [blocker]  Resolve abc-dep sibling
           rows: Sibling repos.abc-dep
           actions:
             - prompt: "Where is abc-dep?" (~/Projects/abc-dep | ../abc-dep | Skip)
           auto_executable: false

  fix-004  [warning]  Scope permissions and enable openspec and sre plugins
           rows: Sandbox permissions.just test, Plugins recommended.openspec, Plugins recommended.sre
           actions:
             - edit:  .claude/settings.json   permissions.allow add "Bash(just test:*)"
             - edit:  .claude/settings.json   enabledPlugins set "openspec@skills" true
             - edit:  .claude/settings.json   enabledPlugins set "sre@skills" true
           auto_executable: true

  fix-005  [warning]  Expand CLAUDE.md
           rows: Agent doc
           actions:
             - template: claude-md-template.md -> ./CLAUDE.md, sections "Development Environment", "Quick Commands", "Testing"
           auto_executable: false
```

Uplift applies `fix-004` and `fix-005` in Phase 4, prompts on `fix-003`, and leaves `fix-001` and `fix-002` (machine state) for the user to run. In report-only modes it applies none of them.
