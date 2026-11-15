---
name: graphite
description: Stacked PRs with the Graphite CLI (gt) — create, stack, submit, update, restack, sync, split, and merge branches, and work review feedback across a stack. Use when the user mentions Graphite, gt, or stacked PRs, or the repo is Graphite-initialized. Plain single-branch PRs → /gh:open-pr.
argument-hint: "[create | submit | update | merge | sync | restack | split | feedback]"
effort: medium
---

$ARGUMENTS

# Graphite stacked PRs

Graphite tracks each branch's parent in its own metadata. Every branch, PR, restack, and
merge goes through `gt` so that metadata stays true; a plain `git` or `gh` write behind its
back leaves the stack out of sync and the next `gt` command fights it.

Full flag catalog: [references/commands.md](references/commands.md).

## Is this a Graphite repo?

The repo is initialized when `test -f "$(git rev-parse --git-common-dir)/.graphite_repo_config"`
succeeds (the common dir, so it also works from a linked worktree). Do not probe with
`gt trunk` or another `gt` command: in an uninitialized repo they initialize it
immediately. If `gt` is installed but the repo is not initialized and the user asked for
Graphite, run `gt init --trunk <default-branch>`. If the
repo does not use Graphite and the user did not ask for it, this skill does not apply —
use /gh:open-pr, /gh:push, and /gh:rebase.

## Rules

- **`gt` for writes, `gh` for reads.** Create, submit, update, merge, close, and delete with
  `gt`. Use `gh` only to read PR state, checks, and comments, and for the writes `gt` has
  no non-interactive command for: resolving review threads over GraphQL, and setting a PR
  description with `gh pr edit <n> --body-file <file>`. Neither touches stack metadata.
- **No `git merge`, `git rebase`, or `git pull` inside a stack.** Use `gt sync`,
  `gt restack`, and `gt modify`. `git add` and `git commit` for staging are fine;
  `gt modify` folds them into the branch.
- **Sync before new work.** `gt sync` pulls trunk, restacks every branch, and cleans up
  merged ones.
- **One logical change per branch.** Small branches review faster and conflict less.
- **Prompts need a terminal.** In an agent shell, add the global `--no-interactive` flag
  and use the non-interactive form: `gt submit --no-edit`, `gt checkout <branch>`,
  `gt move --onto <branch>`, `gt sync --force`, `gt track --parent <branch>`,
  `gt absorb --force`, `gt squash --no-edit`. `gt reorder` and every `gt split` mode but
  `--by-file` are interactive only; build the new stack with `gt split --by-file
  <pathspec>`, `gt create`, or `gt move --onto` instead.
- **Merging and deleting are the task, not a gate.** When the user asks to merge, merge
  once checks are green. Ask first only before `gt delete` on a branch holding commits
  that exist nowhere else and that the user did not ask to drop.
- **Write copy like a person.** PR titles use a conventional-commit prefix, lowercase after
  it, under 60 characters, no trailing period. Descriptions say what changed, why, and how
  to test, in short paragraphs. Rules and examples are in
  [references/pr-copy.md](references/pr-copy.md); /humanizer covers the general prose
  habits if it is installed.

## Workflows

### Open a PR

```bash
gt sync
gt create -am "feat: add user avatar upload"   # branch name derives from the message
gt submit --no-edit                             # title from the commit subject
```

Write the commit subject as the PR title. To set the description, write it to a temp file
and run `gh pr edit <n> --body-file <file>` after the submit (`gt submit --cli` and
`--edit-description` both prompt). Changes already on a tracked branch: just
`gt submit --no-edit`. An untracked branch made with plain git: `gt track --parent <parent>`
first.

### Stack another PR on top

```bash
gt create -am "feat: show avatar in nav"   # stacks on the current branch
gt ss                                       # gt submit --stack: submit the whole stack
```

### Update a PR

```bash
gt modify -a              # amend the current branch; restacks branches above it
gt submit --no-edit       # push, keep existing title and description
```

`gt modify -c -am "msg"` adds a new commit instead of amending. Re-edit the description
with `gh pr edit <n> --body-file <file>` (`gt submit --edit` is the interactive form).

### Respond to review feedback mid-stack

```bash
gt checkout <branch>      # the branch the feedback is on
# fetch unresolved threads — references/review-threads.md
# make the fixes
gt modify -a
# resolve each addressed thread over GraphQL — references/review-threads.md
gt restack                # if modify did not already restack everything above
gt ss
```

Resolve threads silently. Do not post "done" or "fixed" comments.

### Collect feedback across a stack

`gt log short` lists the branches; `gh pr view <branch> --json number --jq .number` maps
each to a PR; run the thread query from
[references/review-threads.md](references/review-threads.md) per PR and keep
`isResolved == false`.

### Merge

```bash
gt log short                                     # confirm the stack shape
gt submit --no-edit                              # make sure the latest is pushed
gh pr checks <branch>                            # read-only CI check
gt merge --dry-run                               # what will merge
gt merge                                         # merges trunk..current, bottom up
gt sync --force                                  # pull trunk, delete merged branches
```

`gt merge` always merges from the bottom of the stack up to the current branch. If checks
are red, fix them on the failing branch (`gt checkout`, fix, `gt modify -a`, `gt ss`)
before merging; /gh:monitor-pr can watch CI.

### Sync and resolve conflicts

```bash
gt sync
# on conflict: fix the files, then
git add <files>
gt continue               # or gt abort to back out
```

`gt undo` reverts the last Graphite operation if a restack went wrong.

### Reshape a stack

- **Split** a branch: `gt split --by-file <pathspec>` moves matching files into a new parent
  branch without prompting; `--by-commit` and `--by-hunk` are interactive. Then `gt ss`.
- **Reorder**: `gt reorder` (interactive), then `gt ss`.
- **Move** a branch to a new parent: `gt move --onto <branch>`.
- **Insert** a branch between the current one and its child: `gt create -i -m "msg"`.
- **Fold** a branch into its parent: `gt fold`. **Squash** its commits: `gt squash`.
- **Route fixups**: with staged hunks that belong to different branches, `gt absorb`
  amends each into the right one.

## Report

End with the stack as `gt log short` shows it, the PR URLs submitted or merged, threads
resolved, and anything left open (red checks, unresolved feedback, conflicts).
