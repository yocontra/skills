---
name: skill-improver
description: Review and fix Claude Code skills and plugins — SKILL.md frontmatter, routing descriptions, body and description budgets, unreachable references, approval gates, prompt anti-patterns, missing evals. Use for "review my skill", "improve this SKILL.md", "audit this plugin". Writing eval cases → plugin-evals.
argument-hint: "[path to SKILL.md, skill dir, or plugin dir] [--report]"
effort: high
---

$ARGUMENTS

# Skill improver

Review a skill against the criteria below, fix what it finds, and report. `--report` makes
it read-only: findings table, no edits. Without it, fix every error and every warning that
is not a deliberate choice, then report.

## 1. Load

- A file path: read it. A directory: glob `**/SKILL.md` under it (skip `evals/` and
  `node_modules/`). Review skills one after another in this context; do not spawn an
  agent per skill.
- Read the nearest `.claude-plugin/plugin.json`, and list the skill's `references/` and
  `scripts/` so you know what ships.
- Find the house rules. If the repo root has a `CLAUDE.md` or `AGENTS.md` with skill
  rules, or `scripts/check-cost.mjs` / `scripts/check-evals.mjs`, those override the
  defaults here (budgets, required frontmatter, eval layout). Otherwise use the defaults.

## 2. Mechanical checks

Run the bundled linter first; it prints derived findings only:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/skill-improver/scripts/lint-skill.mjs" <path> [--desc-max 350] [--body-max 500]
```

It checks frontmatter delimiters and keys, `name` against the directory, `references:`
misuse, a missing `effort:`, description length (plain, quoted, or block scalar) and YAML
quoting, body length, broken and unreachable links, the anti-pattern regexes, likely
approval gates, hard-coded home paths, and fan-out without a model knob. In a repo with
its own `scripts/check-cost.mjs` and `scripts/check-evals.mjs`, run those too; they are
the gate that counts there.

## 3. Judgment review

Read the skill and grade it against [references/criteria.md](references/criteria.md). The
short version, in severity order:

**Error** — blocks loading, misroutes, or costs every session:

- Frontmatter broken: missing `---` delimiters or `name`, an unquoted description
  containing `: `, one that opens a quote it never closes (`"Foo" bar`), a `references:`
  key standing in for body links.
- Description over budget (350 chars by default; the platform hard limit is 1024) or
  carrying anything other than routing: trigger phrases, the job in a few words, and a
  pointer away from the nearest neighbor skill ("Whole-codebase audit → refine:code-cleanup").
- Body over 500 lines; a linked file missing; a shipped `references/*.md` linked from
  nowhere, so it is never loaded.
- `allowed-tools` naming tools that do not exist, or instructions that need a tool it omits.
- Contradictory rules: "always X" in one section, "never X without Y" in another.
- Hard-coded machine paths in instructions or scripts; use `${CLAUDE_PLUGIN_ROOT}` for
  files the plugin ships and relative paths for the target repo.

**Warning** — degrades results or cost per invocation:

- Approval gates: "confirm before", "ask the user", "offer to", per-step "keep or edit?".
  Rewrite to act-then-report. Asking stays only when the request is ambiguous enough to
  produce materially different work, or the action irreversibly destroys data the task did
  not ask to destroy. Asking for something discoverable (repo, roster, time window) is a
  gate too: pick a default and list it under Assumptions.
- Prompt anti-patterns: all-caps emphasis labels, thoroughness boosters, instructions to
  re-check finished work, scratchpad or visible-reasoning scaffolds, motivational
  preambles. Rewrite real warnings as plain prose; do not delete them.
- Unbounded output: commands with no `--limit`, `--json` field list, `head`, or `--tail`;
  "read the whole diff/log" when only a summary is needed.
- Lookup material inline: catalogs, enum tables, long prompt templates, and worked
  examples belong in `references/`, linked from the step that needs them.
- Fan-out: four or more parallel agents without a model knob and a cost note; a fixed
  fleet size instead of one scaled to the input; agents spawned to read one file each; no
  bound on each agent's report length.
- Ambiguous or missing constraints, no output format, no exit condition on a loop, no
  handling for empty or huge input or a failing tool.
- No `effort:` in frontmatter.
- Fetched third-party text passed to subagents without being marked as data.

**Minor** — fix unless clearly intentional:

- Redundancy, backstory, inconsistent terms for one concept, a stale cross-reference to a
  renamed skill, a missing `argument-hint`.

## 4. Fix

Apply fixes in place, error first. Keep every substantive command, fact, and technique;
move rather than delete. When splitting, keep the decision procedure in SKILL.md and put
tables and examples in `references/<topic>.md` with a link from where they are used.
Tighten the description last, once you know what the body actually does.

In a plugin marketplace repo, a changed skill also needs:

- a version bump in its `plugin.json`;
- evals: at least one case asserting the skill fires, plus a negative case. Use the
  repo's `plugin-evals` skill or conventions if present; see
  [references/criteria.md](references/criteria.md#evals) for the minimum.

Then rerun the linter (and the repo's checks) until they pass.

## 5. Report

```
| # | Severity | File:line | Issue | Fix applied |
|---|----------|-----------|-------|-------------|
```

Then: description before → after with char counts, body line count before → after, files
added or moved, checks run with their final result, and any finding left unfixed with the
reason (deliberate choice, needs an owner decision). In `--report` mode the last column is
"Suggested fix".
