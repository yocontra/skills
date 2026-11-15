---
name: open-pr
description: Open a GitHub PR — pre-flight review, fork-aware push, title and description that follow the repo's template and conventions, draft or ready per the repo, then hand off to /gh:monitor-pr for CI and reviews. Body via `--body-file` only.
effort: medium
---

$ARGUMENTS

# Open a PR

In a Graphite-initialized repo (`.graphite_repo_config` in `git rev-parse --git-common-dir`), branches and PRs go through `gt` so the stack metadata stays true: use `/graphite:graphite` when it is installed, not this skill.

```
Detect environment → Pre-flight → Push → Read the branch → Title + body → Create → Hand off → Clean up
```

Facts this skill reads rather than assumes (commands in
[environment.md](../gh/references/environment.md)): the host, whether `origin` is a fork, the
base branch, the PR template, CONTRIBUTING rules, the repo's draft habit, and its labels.

## Exit checklist

Keep this current; the skill is done when every line is checked or named as blocked.

- [ ] PR open, URL reported
- [ ] Handed off: `/gh:monitor-pr` running, or the user/project names another owner for CI
- [ ] Body temp file removed
- [ ] Any work-in-progress label this skill added is removed

## 1. Detect the environment

```bash
gh repo view --json nameWithOwner,isFork,parent,viewerPermission,defaultBranchRef \
  -q '"\(.nameWithOwner) fork=\(.isFork) parent=\(.parent.owner.login // "")/\(.parent.name // "") perm=\(.viewerPermission) default=\(.defaultBranchRef.name)"'
git remote -v | awk '$3 == "(push)"'
gh pr view --json url -q .url 2>/dev/null       # a PR already exists? then this is /gh:push's refresh, not a new PR
```

Set `BASE` to the branch the user named, else the target repo's default branch. Set
`TARGET` (the repo the PR goes to) and `PUSH_REMOTE` from the fork table in
environment.md. Read the PR template and the PR/commit sections of CONTRIBUTING if they exist.

## 2. Pre-flight

Reviewers see what you ship; fix it first.

1. **Size the diff**: `git diff --shortstat <base-remote>/$BASE...HEAD`, ignoring lockfiles and
   generated output.
2. **Review it**: `/gh:review` in pre-PR mode. At 150 changed lines or more, run
   `/refine:simplify` first if that plugin is installed. Address what they find. Skip if it
   already ran on this HEAD, or if the user said to be quick.
3. **A failure your diff did not cause**: check whether someone owns it before fixing it in
   this PR. Search `gh pr list --state open --limit 10 --search "<test or file name>"`, and if
   other agents share the repo, ask them (`SendMessage`). Owned: link it and carry on. Not
   owned: say you are taking it, then fix it, ideally in its own PR.
4. **Run the checks CI will run** for what you touched: lint, format, type-check, the
   relevant tests.
5. **Commit history**: no process metadata (see banned phrases). Rewrite before pushing.

## 3. Push

Use `/gh:push` if there are uncommitted changes. Then make sure the branch is on
`PUSH_REMOTE`: `git push -u "$PUSH_REMOTE" HEAD`.

## 4. Read the branch

Describe what is there, not what you remember:

```bash
git log --oneline <base-remote>/$BASE..HEAD | head -50
git diff --stat <base-remote>/$BASE...HEAD | tail -40
git diff <base-remote>/$BASE...HEAD -- <the files that carry the change>
```

## 5. Title

Follow CONTRIBUTING's format when it has one (Conventional Commits, a tracker prefix).
Otherwise: imperative, present tense, under ~70 characters, `<Verb> <what> [in <context>]`.

| Good | Bad |
|---|---|
| Add user authentication | Added user authentication |
| Fix memory leak in cache | Fixing memory leak |

No `WIP`/`DNM` prefixes (use a draft instead), no tracker IDs unless the repo wants them.

## 6. Body

Write the body to a temp file with the Write tool and pass it with `--body-file`; never inline
(see `/gh:gh`). Remove the file once the PR is created.

```bash
body=$(mktemp "${TMPDIR:-/tmp}/pr-body.XXXXXX")
```

**A PR template wins.** Fill its sections in order, keep its checkboxes, and tick only what is
true. With no template:

1. Lead with one sentence on why the change exists. No `## Summary` header; the opening is
   the summary.
2. Then what changed, by logical area, in short bullets or paragraphs.
3. Never count things ("25 tests", "14 files"). A count goes stale on the next commit and says
   nothing about coverage. This holds inside a Test plan section the user hands over: keep its
   other lines, drop the count, say why.
4. Do not narrate tests or CI. A `## Test plan` section is fine when the repo or user wants one.
5. Skip what the diff already shows; spend words on intent and non-obvious decisions.
6. Put links (issues, design docs) inline where they matter. `Fixes #123` where the repo
   closes issues that way.
7. Claim nothing you did not see happen. "Verified by hand, no test covers it" beats implied
   coverage.
8. Name the weak spot: the assumption you are least sure of, where to look hardest.
9. Length follows the change. A one-line fix gets two or three sentences.

**Banned in title, body and commit messages:**

| Banned | Why |
|---|---|
| "Implemented across N parallel agents", "after a 6-agent review" | Workflow leak |
| "per <skill or tool name>", "post-review pass" | Tool names do not belong in history |
| "Generated by Claude", "with Claude Code", co-author trailers for the agent | Attribution noise, unless the repo requires a disclosure line |

Run `/humanizer` over the body if that plugin is installed. Code blocks stay verbatim.

## 7. Create

**Draft or ready:** the user's request, then CONTRIBUTING, then what most of the last ten PRs
did (`gh pr list --state all --limit 10 --json isDraft -q '[.[] | .isDraft] | group_by(.) | map("\(.[0])=\(length)") | join(" ")'`).
Nothing says: ready. A user who calls the work finished or wants the team to look at it has
asked for ready: open it without `--draft` and skip the habit check.

```bash
gh pr create --base "$BASE" --title "<title>" --body-file "$body" [--draft] \
  [--repo "$TARGET" --head "<you>:<branch>"]        # the second line only for a fork
rm -f "$body"
gh pr view --json number,url -q '"\(.number) \(.url)"'
```

Reviewers: add them only when the user names them or CODEOWNERS does not already request
them. Labels: only ones `gh label list` shows and the repo convention calls for.

## 8. Hand off CI and reviews

Creating the PR is the middle of the job. Unless the user or the project instructions name
another owner for CI follow-up (a sweep agent, a bot), run `/gh:monitor-pr <number>` until
checks are green and reviews are handled. If another owner exists, apply the label the project
uses for that handoff, if any, and stop.

A reviewer question the code or the PR's history answers gets a short reply on its thread. One
that needs a product decision only the user can make goes back to the user.

## 9. Keep the description fresh

When scope changes, after a rebase, or before asking for re-review, rewrite the title and body
for the whole branch as it is now: no "also adds", keep existing links, same rules as step 6.
Same temp-file pattern, `gh pr edit <n> --title … --body-file "$body"`, then `rm -f "$body"`.

## 10. Clean up

- Remove the body file (`rm -f "$body"`) even if `gh pr create` failed.
- If you added a work-in-progress label while still pushing, remove it at handoff:
  `gh pr edit <n> --remove-label "<label>"`. Leave labels you did not add.
- Do not delete the branch: the PR needs it.
