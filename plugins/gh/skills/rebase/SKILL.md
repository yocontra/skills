---
name: rebase
description: Rebase the current branch onto the latest base branch (fork-aware), scaling conflict-analysis agents to the real conflict count. Pushes with `--force-with-lease`, never `--force`, and reports what it did; asks only before dropping someone else's commits.
effort: medium
---

$ARGUMENTS

# Rebase

In a Graphite-initialized repo (`.graphite_repo_config` in `git rev-parse --git-common-dir`), branches and PRs go through `gt` so the stack metadata stays true: use `/graphite:graphite` when it is installed, not this skill.

```
Detect base → Back up → Rebase → (conflicts: scaled agents) → Verify → Push → Clean up
```

Run the rebase first. Spawn analysis agents only for files git actually fails to merge; most
rebases are clean and spawn none.

Invoking the skill is the go-ahead for the whole flow, push included: do not ask for approval
before pushing. Report what you did when it is done.

## Exit checklist

- [ ] Rebased onto the latest base, or aborted with the branch restored
- [ ] Pushed with `--force-with-lease`, or left local with the reason
- [ ] Analysis agents finished or stopped (`TaskStop`)
- [ ] Session temp dir removed
- [ ] Backup branch deleted after a successful push, or its name reported if kept

## 1. Detect the base

```bash
git status --porcelain | head -5          # uncommitted changes? stop and report: never stash or discard them
BRANCH=$(git branch --show-current)
BASE=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null \
  || gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
```

Pick the remote that holds the real base: `upstream` when `origin` is your fork, else `origin`
(see [environment.md](../gh/references/environment.md)). Call it `$UP`.

```bash
git fetch "$UP" "$BASE"
git rev-list --count HEAD.."$UP/$BASE"     # 0: already up to date, stop here
```

Make a session directory for analysis files. Each Bash call is a fresh shell, so remove it
explicitly in step 7 rather than relying on a trap:

```bash
REBASE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/gh-rebase.XXXXXX"); echo "$REBASE_DIR"
```

## 2. Back up

```bash
BACKUP="backup/$BRANCH-pre-rebase"
git rev-parse --verify --quiet "$BACKUP" >/dev/null && BACKUP="$BACKUP-$(date +%Y%m%d%H%M%S)"
git branch "$BACKUP"
```

Never overwrite an existing backup branch: it may be the only copy of older work. The suffix
keeps both. Echo `$BACKUP` and reuse the literal name: each Bash call is a fresh shell.

## 3. Rebase

```bash
git rebase "$UP/$BASE"
```

Exit 0: go to step 5. On a conflict:

```bash
git diff --name-only --diff-filter=U > "$REBASE_DIR/conflicting-files.txt"; wc -l < "$REBASE_DIR/conflicting-files.txt"
git diff "$UP/$BASE"..."$BACKUP" > "$REBASE_DIR/local-diff.txt"
git diff "$BACKUP"..."$UP/$BASE" > "$REBASE_DIR/upstream-diff.txt"
git log --oneline "$BACKUP".."$UP/$BASE" > "$REBASE_DIR/upstream-commits.txt"
git log --oneline "$UP/$BASE".."$BACKUP" > "$REBASE_DIR/local-commits.txt"
```

## 4. Resolve, scaled to N conflicting files

Agents read the files under `$REBASE_DIR` by path and write their analysis there; they never
edit the repo. Spawn each tier's parallel agents in one message.

| N | Agents |
|---|---|
| 1–3 | None: resolve them yourself, inline |
| 4–10 | Upstream-context and local-context agents in parallel, then you resolve with both summaries |
| 11+ | Those two plus resolver agents, each taking 5–10 files: `min(3, ceil(N/8))` resolvers, 5 agents at most |

- **Upstream context**: from `upstream-diff.txt` and `upstream-commits.txt`, what the base did
  on purpose: features, refactors, deliberate removals, moved files. Under 300 words.
- **Local context**: from `local-diff.txt` and `local-commits.txt`, what the branch does,
  grouped by concern, core vs incidental. Under 300 words.
- **Resolver**: for its files, read the conflict markers and both summaries, draft the merged
  file, and say per hunk which intent wins and why, in `$REBASE_DIR/resolutions-<k>.md`.

**Honor both intents.** The base's commits are reviewed decisions; the branch integrates with
them rather than reverting them.

| Base did | Branch did | Resolution |
|---|---|---|
| Added something | Unrelated work nearby | Keep the addition |
| Refactored | Changed the same area | Re-express the branch's change in the new shape |
| Fixed a bug | Changed the same code | Keep the fix inside the branch's version |
| Changed shared infra (CI, config) | Changed it differently | Keep the base's; fold the branch's need in |
| Removed something deliberately | Uses or extends it | Escalate: a design disagreement, not a merge conflict |
| An incompatible architecture choice | Another one | Escalate |

To escalate, `git rebase --abort` (the backup stays intact) and report one specific question:
the paths, what each side intended, and what needs deciding.

Diff direction trap: `git diff HEAD..$UP/$BASE` shows the branch's additions as deletions.
"Base doesn't have X" is not "base removed X"; check the base's commits.

Lockfiles and generated files are not merged by hand: take the base's side, regenerate, and
`git add` the output.

Apply each resolution, `git add <file>`, then `git rebase --continue`. A later commit can stop
again: refresh `conflicting-files.txt` and repeat for the new set. If the rebase gets into a
state you cannot reason about, `git rebase --abort`; the backup is intact.

## 5. Verify

```bash
git log --oneline "$UP/$BASE"..HEAD | head -50
git range-diff "$UP/$BASE" "$BACKUP" HEAD | head -80
```

Every local commit should still be there (same count unless the user asked to squash, or a
commit became empty because the base already has it). Run the build and the tests the change
touches: a silently wrong resolution is what this catches.

## 6. Push

Check that the remote branch holds nothing you would drop. Commits by someone else that are on
the remote but not in your history are the one case to stop and ask: the push would destroy
their work.

```bash
git fetch origin "$BRANCH"
git log HEAD..origin/"$BRANCH" --format='%an %h %s' | head -20     # empty, or only your own pre-rebase commits
gh pr view --json reviews --jq '[.reviews[] | .author.login | select(test("\\[bot\\]$|^dependabot$|^copilot") | not)] | unique | .[]' 2>/dev/null
git push --force-with-lease
```

A rejected lease means someone pushed meanwhile: stop and report. Never retry with `--force`.

Report the commits before and after, the conflicts you resolved and how, the remote and branch,
and any human reviewers: their "Show changes since last review" view resets with the rewrite,
so say that in the report.

Then hand back to `/gh:monitor-pr` if the PR was being monitored, and refresh the PR body
(`/gh:push` step 6) if the rebase changed its scope.

## 7. Clean up

```bash
rm -rf "$REBASE_DIR"
git branch -D "$BACKUP"     # only after a successful push
```

- Pushed: delete the backup.
- Aborted, or left local: keep the backup and tell the user its name and how to
  restore it (`git reset --hard <backup branch>`, which they run, not you).
- Stop any analysis agent still running (`TaskStop`).
- Remove only what this run created: never another backup branch or a file outside `$REBASE_DIR`.
