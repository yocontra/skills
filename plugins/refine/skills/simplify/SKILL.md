---
name: simplify
description: Tidy up just-changed code — the current diff only — for reuse, redundancy, efficiency, and structure, then an adversarial behavior-preservation pass reverts any edit that changed behavior. Triggers on simplify, clean this up, tidy what I just changed. Whole-codebase audit → refine:code-cleanup.
effort: high
---

$ARGUMENTS

# Simplify

Simplify changed code without altering its behavior, following the project's own conventions. Prefer readable, explicit code over compact solutions, and propose a better abstraction when the current shape obscures intent.

Two properties hold on every path below:

- **Scope is the current diff** unless the user passes `--forever` or names a broader scope. A whole-codebase audit is `refine:code-cleanup`, not this skill.
- **Editing is two stages.** A simplifier edits, then a separate adversarial behavior-preservation review diffs each edit against a pre-edit snapshot and restores the snapshot if it can show behavior changed. "I was careful" is not the second stage. Skipping the review is the one way this skill causes damage, so it runs on every path: workflow, agents, or inline.

Run conventions shared with the other refine skills (command detection, git and non-git targets, temp dir, fix-mode hygiene, spawning, stopping) are in [shared/run-hygiene.md](../../shared/run-hygiene.md).

## 1. Resolve scope and size

- **In git:** files from `git diff --name-only HEAD` plus untracked files the user created this session; size from `git diff --shortstat HEAD` (insertions + deletions = `changedLines`). Pin `worktree`: `--worktree <path>` → enclosing repo of the first scoped file → `git rev-parse --show-toplevel`, as an absolute path. Subagents inherit the orchestrator's cwd, so without the pin they can edit the wrong tree.
- **Outside git, or `--forever`, or a named scope:** collect the files with `Glob` (outside git with no paths given, the current directory; say so). Size is the line count of the files.
- Make the run's temp dir (`mktemp -d`, see the shared conventions) and use `$RUN_DIR/snapshots` as `snapshotDir`. Record the fix-mode baseline.
- Read the project's `CLAUDE.md` for the standards to pass along, and detect a test or lint command for the gate. If none exists, say so and run without a gate.

## 2. Pick the path by size

| Diff | Agents | Path |
|---|---|---|
| Under 50 changed lines | none | [Inline](#inline) |
| 50–149 changed lines | 1 simplifier + 1 reviewer | Workflow (`oneAgentBelow: 150`) |
| 150+ lines, or `--forever` | 1 simplifier + 1 reviewer per file, waves of 16 | Workflow |

Also go inline when you cannot spawn (you are a teammate or a forked worker, neither `Agent` nor `Workflow` is available, or a spawn fails). Do not retry the spawn.

**Cost.** Per-file mode is up to 2 agents per file per pass, and forever mode repeats that for up to 10 passes. For 4+ files, say so in the launch note and name `model: { simplify: "<cheaper model>" }` as the knob; set it when the user asked to save cost. The simplifier does ordinary editing, but keep the reviewer on the session model because it decides what survives. Lower `effort` before you downgrade a model.

## 3. Workflow path

State the budget before launch: about 3 min plus 1 min per 10 files per pass. While it runs, report `elapsed Ns / budget Ns`. The pass cap is the hard stop.

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/simplify/sweep.js",
  args: {
    files: [...], changedLines: <n>, snapshotDir: "<RUN_DIR>/snapshots",
    worktree: "<absolute path, or omit outside git>", standards: "<key CLAUDE.md rules>",
    forever: { enabled: <bool>, cap: 10 },
    runGate: { enabled: <bool>, command: "<detected test/lint command>" },
    model: { simplify: "<model or omit>", review: "<model or omit>" },
    effort: { simplify: "medium", review: "high" }
  }
})
```

If `${CLAUDE_PLUGIN_ROOT}` does not expand in `scriptPath`, resolve it with `echo "${CLAUDE_PLUGIN_ROOT}"` and pass the literal path. If the `Workflow` tool is unavailable or disabled, spawn the same two roles with `Agent` (one simplifier, then one reviewer per batch, per the table) using the prompt files below, or go inline.

## Inline

Run both stages in this context, in order:

1. Copy every file in scope into `$RUN_DIR/snapshots/` (one `cp` per file) before the first edit.
2. Simplify per [prompts/simplify-file.md](../../workflows/simplify/prompts/simplify-file.md).
3. Review every edit per [prompts/behavior-preservation-review.md](../../workflows/simplify/prompts/behavior-preservation-review.md). Run `diff -u <snapshot> <file>` and judge from the diff, not from your memory of why the edit was safe. Restore a file by copying its snapshot back, never from git, because a checkout would discard the user's uncommitted work. Delete any new file the simplifier created when you revert the edit that created it.

## Forever mode

With `--forever`, or when a parent workflow asks for continuous simplification, sweep all files in scope, not just changed ones. Re-sweep after each pass until a pass makes no surviving change, with a hard cap of 10 passes. If a pass changes the same set of files as an earlier pass (oscillation), stop and report those files as "conflicting simplification targets — requires manual decision".

## Report

Print the ledger: files simplified, reverted, and unverified (left in place without a review verdict, so they need manual inspection), plus the gate result or "no gate command found". Do not write it to a file unless the user gave a path.

## Exit checklist

Keep this list current. A turn that ends while an item is open is a progress report, so continue or name the blocker.

- [ ] Both stages ran for every edited file: each file has a review verdict, or it is listed as unverified.
- [ ] Every workflow run or agent this skill started has returned or been stopped with `TaskStop`.
- [ ] The tree matches the baseline except for the intended edits: stray untracked files are deleted, and there is no new stash, commit, or branch (see [fix-mode hygiene](../../shared/run-hygiene.md#fix-mode-hygiene)).
- [ ] The gate ran, or the report says why it did not.
- [ ] `rm -rf "$RUN_DIR"`. This removes the snapshots, so do it only after the review is done. Outside git, keep it until the user has accepted the edits, and print its path.
- [ ] The ledger is printed.
