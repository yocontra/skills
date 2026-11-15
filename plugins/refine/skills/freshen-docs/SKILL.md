---
name: freshen-docs
description: Sweep stale code comments, docstrings, TODOs and docs — finder/skeptic/referee trios challenge each claim, and only confirmed-wrong prose is rewritten — never the code.
effort: high
---

$ARGUMENTS

# Freshen docs

Adversarial staleness hunting. Three roles with opposing goals filter out false positives and keep real staleness:

| Role | Goal |
|------|------|
| **Finder** | Report every comment or doc it can prove is stale |
| **Skeptic** | Prove the comment or doc is still correct |
| **Referee** | Decide what gets fixed |

The code is the authority. Only prose changes (comments, docstrings, TODOs, docs), never code. A single stale line the user reports ("the README still mentions X") is one instance of drift, not a scope: fix it, and sweep every documentation surface plus source comments and docstrings for the same class of drift, checking each claim against the current code.

Run conventions shared with the other refine skills (command detection, git and non-git targets, temp dir, fix-mode hygiene, spawning, stopping) are in [shared/run-hygiene.md](../../shared/run-hygiene.md).

## 1. Resolve scope

- Named scope (`docs`, `src/api`, or comma-separated paths): collect the files with `Glob`. Otherwise use the project root, and let recon enumerate the files, always including documentation surfaces.
- In git, pin `worktree` to an absolute path: `--worktree <path>` → enclosing repo of the first scoped file → `git rev-parse --show-toplevel`. Fix agents edit whatever tree they land in.
- Outside git, apply the fixes too, with a backup dir of its own, outside `$RUN_DIR` so the temp-dir cleanup cannot delete it: `BACKUP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/freshen-docs-backup.XXXXXX")`, passed as `backupDir`. Each file is copied there before its first edit, so any edit can be restored. Set `applyFixes: false` only when the user asked for a report alone.
- Make the run's temp dir (`mktemp -d`) only if a fallback or a non-git run needs one, and record the fix-mode baseline.

## 2. Pick the path by size

| Scope | Path |
|---|---|
| 1–3 files | Inline: play finder, skeptic, and referee yourself, in order, then fix. No agents. |
| You cannot spawn (teammate, forked worker, no `Workflow`/`Agent`) | Inline, whatever the size. Read the code and docs directly and run every role, without trying a spawn first. |
| 4+ files | Workflow (step 3), or the [prose fallback](references/prose-fallback.md) with `Agent` if `Workflow` is unavailable |

**Cost.** One cycle is 1 recon, 1 hunter per zone (1 for under 6 files, up to 6), 1 dedup, about 2 agents per 4 findings (skeptic and referee), and 1 fix agent. A whole project is typically 10–25 agents. To bound it, name a narrower scope, or pass `model: { hunter: "<cheaper model>", recon: "<cheaper model>" }`. Keep the skeptic and referee on the session model, because they decide what is rewritten. Lower `effort` before you downgrade a model.

## 3. Workflow path

State the budget before launch: about 12 min for a whole project, less for a named scope. While it runs, report `elapsed Ns / budget Ns`. At 2× the budget with agents still running, read the workflow journal instead of waiting.

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/freshen-docs/audit.js",
  args: {
    ...<${CLAUDE_PLUGIN_ROOT}/skills/freshen-docs/audit.config.json>,
    scope: { rootDescription: "<root>", files: [...], constrained: <true if the user named a scope> },
    worktree: "<absolute path, or omit outside git>",
    backupDir: "<$BACKUP_DIR outside git, else omit>",
    model: { hunter: "<model or omit>" },
    promptsDir: "${CLAUDE_PLUGIN_ROOT}/workflows/freshen-docs/prompts"
  }
})
```

If `${CLAUDE_PLUGIN_ROOT}` does not expand in `scriptPath`, resolve it with `echo` and pass the literal path. The config sets `applyFixes: true`, so referee-confirmed fixes marked auto-safe are applied, and the rest come back for manual review.

## 4. Report

Print the returned verdict block, then:

- the confirmed fixes that were applied,
- directly after them, the **checked and left unchanged** table: every suspected item found still accurate, with title, file, and why it was rejected, so the reader sees what was examined and left alone,
- the conditional items and the manual-review list.

The full report layout is in the [prose fallback](references/prose-fallback.md#report). Write a report file only to a path the user gave.

## Rules

- The user decides scope. The default is the whole project, comments and docstrings included. A reported stale line is an instance, not a scope.
- Correct factual inaccuracies only: no rewrites for style, no new comments, no code changes, and no edits to generated or vendored files.
- The role protocols live in the [prompts](../../workflows/freshen-docs/prompts/). Do not restate or override their rules here.

## Exit checklist

Keep this list current. A turn that ends while an item is open is a progress report, so continue or name the blocker.

- [ ] Every finding has a referee verdict, or is listed as unreviewed.
- [ ] Every workflow run or agent this skill started has returned or been stopped with `TaskStop`.
- [ ] Only prose changed: `git diff --stat` touches comments and docs only, no stray untracked files remain, and there is no new stash, commit, or branch (see [fix-mode hygiene](../../shared/run-hygiene.md#fix-mode-hygiene)).
- [ ] `rm -rf "$RUN_DIR"` if one was made. Outside git, keep `$BACKUP_DIR` and print its path, so any edit can be restored.
- [ ] The report is printed, with the checked-and-left-unchanged table.
