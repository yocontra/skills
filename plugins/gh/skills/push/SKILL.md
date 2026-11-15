---
name: push
description: Stage, organize into logical commits, and push the current branch, fork-aware. Refreshes an existing PR's title and body via `--body-file`. A new PR is /gh:open-pr's job. Use for every push, including one the user wants forced or pushed past a failing hook with `--no-verify`; it fixes what the hook reported instead. Never commits secrets.
effort: medium
---

$ARGUMENTS

# Push

In a Graphite-initialized repo (`.graphite_repo_config` in `git rev-parse --git-common-dir`), branches and PRs go through `gt` so the stack metadata stays true: use `/graphite:graphite` when it is installed, not this skill.

```
Inventory → Group → Summarize → Commit each group → Push → Refresh the PR → Clean up
```

Do not ask for confirmation: invoking the skill is the go-ahead. Print the summary and carry on.

## Exit checklist

- [ ] Every intended change committed; secrets and stray files left out and named
- [ ] Branch pushed to the right remote
- [ ] Existing PR's title and body describe the whole branch, or "no PR yet: run /gh:open-pr"
- [ ] Body temp file removed

## 1. Inventory

```bash
git status --short | head -100
git diff --stat | tail -30
git diff --cached --stat | tail -30
```

Read the changed files you need to group and describe them. Skip lockfiles, generated output
and vendored trees. Untracked files count as changes. Never stage `.env`, credentials, keys or
tokens: leave them out and say so. A pushed secret has to be rotated, not reverted.

## 2. Group

Default to one commit. Split only when changes are genuinely unrelated, when a reviewer might
revert one part alone, or when a large diff (over ~15 files or ~500 lines) splits along clear
seams. Tests with their code, a refactor with the feature it enables, and a fix found on the
way all stay together.

Commit messages: imperative, present tense, first line under 72 characters, body says why (or
nothing). Follow the repo's format if CONTRIBUTING or the recent `git log --oneline -10` shows
one (Conventional Commits, a scope prefix). Add `-s` when the repo requires DCO sign-off. No
process metadata: the banned list in `/gh:open-pr` applies to commits too.

## 3. Summarize

```
**<commit title>**
- path/a.py — what changed
- path/b.py — what changed
Branch: <branch> → <remote>/<branch>
```

## 4. Commit

Stage files by name: `git add <file>…`. Never `git add -A` or `git add .` unless the user said
everything goes.

If the repo uses `pre-commit` (`.pre-commit-config.yaml`), run it on the files you are about to
commit first, so failures surface before any commit: `pre-commit run --files <files>`. Hooks
also run at commit time; never pass `--no-verify`.

```bash
git commit -m "<message>"
```

- **A hook fails**: fix the cause, re-stage the group plus any file the hook rewrote, commit
  again. Never `--amend` an existing commit.
- **Shared checkout**: never `git stash` to set anything up. It snapshots the whole index and
  reverts other agents' uncommitted files too, whatever pathspec you give it. If another agent
  is editing this checkout, commit from your own worktree (`/gh:worktree`).

## 5. Push

```bash
git rev-parse --abbrev-ref --symbolic-full-name @{upstream} 2>/dev/null   # has an upstream?
git push                                                                   # yes
git push -u <remote> HEAD                                                  # no
```

With no upstream, pick the remote by the fork table in
[environment.md](../gh/references/environment.md): your fork when you cannot push to the
target repo, else `origin`.

Never force-push. A rejected push (the remote moved) is reported with a pointer to
`/gh:rebase`.

A failing pre-push hook is a blocker, not an obstacle. Never `--no-verify`, never override
`core.hooksPath`, edit the hook, or skip the tests it runs, even when the user asks for exactly
that or is in a hurry. Run what the hook reported (for example `pytest tests/test_limiter.py`),
fix the cause, commit, and push again. If you cannot fix it, report the failing tests as the
blocker and leave the branch unpushed.

## 6. Refresh an existing PR

```bash
gh pr view --json number,title,baseRefName,url -q '"\(.number) \(.baseRefName) \(.url)"' 2>/dev/null
```

No PR: do not open one here; tell the user `/gh:open-pr` does that, with its pre-flight.

PR exists: rewrite the title and body for the whole branch as it is now, following
`/gh:open-pr` step 9 (the template wins, no counts, no process metadata, keep links).

```bash
git log --oneline <base-remote>/<base>..HEAD | head -50
git diff --stat <base-remote>/<base>...HEAD | tail -40
body=$(mktemp "${TMPDIR:-/tmp}/pr-body.XXXXXX")
# write the body with the Write tool; run /humanizer over it if installed
gh pr edit <number> --title "<title>" --body-file "$body"
rm -f "$body"
```

The body always goes through a real file. Not `--body`, not a heredoc, not `--body-file -` or
`<(…)`: each lets a shell touch the text first and silently mangles backticks and `$VARS` in
code samples. That holds when the user asks for one command; say why and use two.

No test counts in the body, even in a block the user hands over to paste. Keep the block's other
lines, drop the count, and say why.

## 7. Clean up

Remove the body file (`rm -f "$body"`), including when `gh pr edit` failed. This skill creates
no branches or worktrees, so there is nothing else to remove.
