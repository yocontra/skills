---
name: worktree
description: Isolated git worktrees for parallel work by several agents on one repo — layout, branch planning, disk-cheap seeding, and safe cleanup or pruning of finished worktrees and merged branches. Use when agents clobber each other's edits in one shared checkout, or stale worktrees pile up.
effort: medium
---

$ARGUMENTS

# Git worktrees for multi-agent work

## The layout you hand back

Any plan for several agents on one repo states these four things:

1. **One worktree and one branch per agent.** Never two agents in one checkout.
2. **A branch lives in one worktree at a time.** Git refuses a second checkout
   (`fatal: 'x' is already used by worktree at …`), so plan branch names before dispatching.
3. **Worktrees you create live in `.worktrees/` at the repo root, and `.worktrees/` is
   ignored.** Check with `git check-ignore -q .worktrees`; if it is not ignored, add it to
   `.git/info/exclude` (local, no commit needed) unless the user wants it in `.gitignore`.
   Claude Code puts its own isolation worktrees in `.claude/worktrees/`.
4. **What is shared and what is not.** Objects, refs and config are shared: a commit in one
   worktree is visible in all at once. HEAD, the index, the working tree, and every build
   artifact (`node_modules/`, `.venv/`, `target/`) are per worktree, and a fresh one has none.

## Exit checklist

For every worktree and branch this task created, and nothing else:

- [ ] Work merged, pushed, or handed off; nothing uncommitted left behind unreported
- [ ] Worktree removed (`worktree.py remove`), metadata pruned
- [ ] Branch deleted if merged, kept and named if not
- [ ] Locks this task added are released
- [ ] Agents working in those worktrees have finished or been stopped (`TaskStop`)

Keep a list of what you created as you go (path, branch, agent); cleanup works from that list,
not from what happens to exist.

## Create with the helper

```bash
wt="${CLAUDE_PLUGIN_ROOT}/scripts/worktree.py"
base=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)   # or the branch the work targets
git fetch origin "$base"
python3 "$wt" add .worktrees/<name> -b <branch> "origin/$base"
```

`add` runs `git worktree add` with your arguments, then on APFS (macOS) clone-seeds from the
main checkout: tracked files of 64 KiB or more whose bytes match, and each ignored
`node_modules/` whose lockfile matches and which npm or pnpm recorded as a finished install of
it. Clones share disk blocks until written. Elsewhere it is a plain `git worktree add`. It
prints what it cloned.

- Install only what was not cloned (`uv sync`, `cargo fetch`, `npm ci` only where no
  `node_modules/` was cloned: `npm ci` deletes one and writes a full copy).
- Never point `UV_CACHE_DIR` into a worktree and never `uv cache clean`; either turns every venv
  into a full copy. `uv cache prune` is fine.
- Claude Code's own worktrees (`isolation: "worktree"`, `--worktree`) are seeded by this
  plugin's PreToolUse hook on their first shell or file tool call. Nothing to run.
- `python3 "$wt" seed <path>` seeds a worktree made some other way.

Naming: `.worktrees/<role>-<task>` with branch `<prefix>/<task>`, for example
`.worktrees/backend-auth` on `feat/auth`.

## Branch strategies

- **Separate branches, merge at the end** (the default): each agent works on its own branch
  from the same base; the lead merges them into the feature branch when all finish. Best when
  agents own different files.
- **Sequential sub-branches**: when one agent needs another's work, the lead merges the first,
  and the second rebases onto it. Agents never cross into each other's worktrees.

Define file ownership before dispatch: no two agents edit the same file. Generated files
(lockfiles, snapshots, codegen) still conflict at merge; plan a step to regenerate them.

## What is safe concurrently

| Operation | Safe? | Note |
|---|---|---|
| `add`/`commit` on different branches | Yes | Separate indexes and HEADs |
| `fetch`, `push` of different branches | Yes | Ref locks may block briefly |
| `rebase` of different branches | Yes | |
| Two worktrees on one branch | No | Git refuses |
| `git config` | Affects all | Use `extensions.worktreeConfig` + `git config --worktree` |
| Manual `git gc` / `git prune` | Avoid | Can cause transient "object not found" in busy worktrees |
| `git stash` in a shared checkout | No | Reverts other agents' uncommitted files, whatever pathspec; decline it even when asked, and do not hand it over as a fallback |

## Clean up what you made

Claude Code does not remove the worktree of an agent or workflow when it finishes, and each
one holds a full working tree plus its installs. Clean up as each piece of work lands, not only
at the end.

```bash
python3 "$wt" remove .worktrees/<name> --delete-branch
```

`remove` refuses a worktree with uncommitted or untracked changes, a locked one, the main
checkout, and the one you are standing in. Otherwise it runs `git worktree remove` (never
`--force`) and `git worktree prune`. `--delete-branch` deletes the branch only when its tip is
already in origin's default branch and no other worktree has it checked out; an unmerged branch
is kept and named. Run it from outside the worktree. Plain `git worktree prune` (not the
helper's `prune`) only clears metadata for directories already gone, so it is safe to run at the
end of a cleanup even when worktrees you did not make remain; say that you ran it.

When `remove` refuses:

- **Uncommitted changes**: the work is not done. Commit and push it, or report the path to the
  user. Never `git worktree remove --force` or `git clean` a worktree to make cleanup succeed.
- **Unmerged branch kept**: correct when its PR is still open. When you already know the PR is
  open, leave `--delete-branch` off that `remove` so the command says what you mean. Delete the
  branch after the PR merges.
  For a squash-merged PR (the branch tip never lands in the default branch), confirm with
  `gh pr view <branch> --json state -q .state` that it is `MERGED`, then `git branch -D <branch>`,
  for a branch you created only.

Release any lock you added: `git worktree unlock <path>`. A worktree deleted with `rm -rf`
leaves metadata that keeps its branch "checked out"; `git worktree prune` clears it.

## Prune stale worktrees

For worktrees that accumulated over time (other sessions, crashed agents):

```bash
git fetch --prune origin
python3 "$wt" prune                       # dry run: what would go, and a count of kept ones per reason
python3 "$wt" prune --apply               # add --verbose to list every kept one and why
python3 "$wt" prune --apply --delete-branches   # also delete each removed worktree's merged branch
```

It looks only under `.worktrees/` and `.claude/worktrees/`, and removes a worktree only when all
hold: unlocked; not the current one; its work has landed (HEAD in origin's default branch, or its
upstream branch was deleted after a squash merge); its index idle for `WORKTREE_PRUNE_MIN_AGE`
seconds (default 7200); clean, untracked files included; and no process has its cwd inside.
Always show the dry run first when the worktrees are not all yours. `--delete-branches` uses the
same merged-only rule as `remove`, so a squash-merged branch is kept.

## Orchestration checklist

**Before dispatch**: `.worktrees/` ignored; one branch per agent, no overlaps; file ownership
set; all worktrees from the same base commit; each created with the helper and its installs run.

**While agents work**: each commits to its own branch in its own worktree; the lead watches with
`git worktree list` and `git log --oneline -5 <branch>`; agents never edit another's worktree.

**After agents finish**: merge their branches into the feature branch, run the full test suite
on the result, then work the exit checklist above for each worktree and branch you created.

## Quick reference

```bash
python3 "$wt" add .worktrees/<name> -b <branch> origin/<base>     # create + seed
git worktree list                                                 # list
python3 "$wt" remove .worktrees/<name> --delete-branch            # remove one you made
python3 "$wt" prune [--apply] [--delete-branches]                 # prune landed ones
git worktree lock <path> --reason "<why>" / git worktree unlock <path>
git worktree prune -v                                             # clear metadata of deleted dirs
git worktree repair                                               # after moving a worktree
```
