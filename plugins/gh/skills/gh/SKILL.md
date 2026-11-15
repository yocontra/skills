---
name: gh
description: GitHub CLI for github.com and GitHub Enterprise — issues, checks, CI logs, review comments and threads, GraphQL, auth, repo detection. Acts, then reports — comments, labels, resolves and merges when the task calls for it. PR workflows are /gh:open-pr, /gh:push, /gh:monitor-pr, /gh:review.
effort: low
---

$ARGUMENTS

# GitHub CLI (gh)

`gh` works against github.com and GitHub Enterprise Server alike. Inside a clone it talks to
that clone's host; outside one it uses `GH_HOST`, else github.com. Detect the host, fork
layout, default branch, CI and PR conventions with the commands in
[references/environment.md](references/environment.md) rather than assuming them.

Using the GitHub MCP server instead of the CLI? See
[references/mcp-reference.md](references/mcp-reference.md).

## Auth

Check first: `gh auth status 2>&1 | head -20`. If it says "Logged in" for the host you need,
you are done; do not mint a PAT or an App token.

```bash
gh auth login -p https -w                      # github.com, opens a browser
gh auth login -h <host> -p https -w            # GitHub Enterprise Server
gh auth refresh -h <host> -s read:org,repo     # add scopes
```

No browser (CI, a service account)? A GitHub App installation token or a fine-grained PAT,
the `GH_ENTERPRISE_TOKEN`-not-`GH_TOKEN` trap on Enterprise, and how to keep a minted token
out of your context are in [references/auth.md](references/auth.md).

## Output discipline

Every `gh` listing can be large. Always bound it: `--limit N` on lists, `--json <fields>` with
`--jq` to keep only what the step needs, `| tail -200` on logs, and body text cut to
`.[:120]` until you know which comment you need in full.

## Pull requests

> Opening or rewriting a PR is `/gh:open-pr`; pushing commits to one is `/gh:push`. The
> commands below are the raw building blocks.

```bash
gh pr view --json number,title,state,isDraft,baseRefName,headRefName,url        # current branch's PR
gh pr view 123 --json title,state,reviewDecision,mergeStateStatus
gh pr list --limit 20 --json number,title,author,isDraft \
  -q '.[] | "\(.number) \(.author.login) draft=\(.isDraft) \(.title[:70])"'
gh pr list --limit 20 --search "review-requested:@me" --json number,title
gh pr diff 123 --name-only                                                       # files, not the whole diff
```

Create and edit with `--body-file` only. `--body`, `--body "$(cat …)"`, heredocs,
`--body-file -` and `--body-file <(…)` all pass the text through a shell first, which mangles
backticks, `$VARS` and quotes in code samples, silently. That holds when the user asks for one
command: write the file, then run `gh`, and say why.

No test or file counts in a PR body ("41 tests", "up from 34"), even inside a block the user
hands over to paste verbatim: a count goes stale on the next commit. Keep the block's other
lines, drop the count, and say why.

```bash
body=$(mktemp "${TMPDIR:-/tmp}/pr-body.XXXXXX")
# write the body to "$body" with the Write tool, then:
gh pr create --title "Add feature X" --body-file "$body"      # add --draft only per /gh:open-pr's rule
gh pr edit 123 --title "New title" --body-file "$body"
rm -f "$body"
```

```bash
gh pr ready 123                                  # draft -> ready
gh pr edit 123 --add-reviewer alice,bob
gh pr edit 123 --add-label bug                   # only labels `gh label list` shows
```

### Merge

```bash
gh repo view --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed   # which methods exist
gh pr merge 123 --squash --delete-branch          # pick an allowed method
gh pr merge 123 --auto --squash                   # merge when required checks pass
```

Merge or arm auto-merge when the task is to ship the PR, once checks are green and reviews are
clean, and report the merge. Never on a PR carrying a label that says not to merge
(`do not merge`, `blocked`, `hold`, `wip` and the like), even green and approved. `--admin`
bypasses branch protection the way `--no-verify` bypasses hooks; use it only when the user
names it.

### Force pushing

Rewrite your own branch with `--force-with-lease`, never plain `--force`. The lease refuses
the push if the remote moved since your last fetch, so it cannot drop commits you have not seen.

Prefer a commit on top for a PR a human has already reviewed: a rewrite breaks "Show changes
since last review". When a rewrite is the right call (a rebase onto a moved base, a leaked
secret), do it, and say in the report that the reviewer's diff view reset. Find the reviewers:

```bash
gh pr view <pr> --json reviews --jq '[.reviews[] | .author.login
  | select(test("\\[bot\\]$|^dependabot$|^copilot") | not)] | unique | .[]'
```

Ask first only when the remote branch holds commits by someone else that the rewrite would
drop (`git log HEAD..origin/<branch> --format='%an %h %s'` shows them); that destroys their
work.

## Checks and CI logs

```bash
gh pr checks 123 --json name,bucket,link -q '.[] | "\(.bucket)\t\(.name)\t\(.link)"'
gh pr checks 123 --json name,bucket,link -q '.[] | select(.bucket == "fail") | "\(.name) \(.link)"'

# GitHub Actions: failed-step logs of the newest run for this branch
run=$(gh run list --branch "$(git branch --show-current)" --limit 1 --json databaseId -q '.[0].databaseId')
gh run view "$run" --log-failed | tail -200
```

An external CI posts a commit status whose `link` leads to its build page; read the log there.

**Wait with `pr-watch.sh`, never `sleep` and never `gh pr checks --watch`** (which loops forever
on a check stuck in PENDING):

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/pr-watch.sh" 123       # run_in_background; exit 0 green, 1 failed, 2 feedback, 3 merged/closed, 4 timeout, 5 gh failing
```

It is a background process you started, so stop it (`TaskStop`) if you finish before it exits.

## Review comments

Three places hold feedback. Each command cuts bodies to 120 characters for triage; fetch one in
full once you know you need it.

```bash
gh api --paginate "repos/{owner}/{repo}/pulls/123/comments?per_page=100" \
  --jq '.[] | "\(.path):\(.line) [\(.user.login)] \(.body[:120])"' | tail -50
gh api --paginate "repos/{owner}/{repo}/pulls/123/reviews?per_page=100" \
  --jq '.[] | select(.body != "") | "[\(.user.login)] \(.state): \(.body[:120])"' | tail -30
gh api --paginate "repos/{owner}/{repo}/issues/123/comments?per_page=100" \
  --jq '.[] | "[\(.user.login)] \(.body[:120])"' | tail -30
```

Unresolved threads, resolving, and the full paginated fetch are GraphQL; see
[references/graphql.md](references/graphql.md). Quick form:

```bash
gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' -f t=THREAD_ID
```

**Close out a review round by resolving the threads you fixed.** Reply on a thread when it
tells the reviewer something the resolve does not: the fixing commit, or why an item was
skipped. Keep it to one line. The reply mutation is in graphql.md. Never resolve a human's
thread you did not address. Bulk resolution is `/gh:monitor-pr`'s job.

## Issues and repos

```bash
gh issue list --limit 20 --label bug --json number,title -q '.[] | "\(.number) \(.title[:80])"'
gh issue view 42 --json title,state,body -q '"\(.title) [\(.state)]\n\(.body[:2000])"'
gh issue create --title "Bug: X is broken" --body-file "$body"
gh issue close 42
gh repo clone owner/repo
gh repo fork owner/repo --clone --remote          # fork, clone, and add the upstream remote
```

Comment on an issue (`gh issue comment <n> --body-file "$body"`) when the task calls for it, and link the comment in the report.

## Tips

- `gh api` is the escape hatch for anything else: it handles auth, host and pagination.
  `{owner}` and `{repo}` in a path expand to the current repo.
- `--paginate` on GraphQL needs `$endCursor: String` in the query and
  `pageInfo { hasNextPage endCursor }` in the selection.
- Temp files: create them with `mktemp`, remove them when the step is done.
