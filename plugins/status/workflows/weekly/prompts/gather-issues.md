# Gather issue activity for a weekly status

Collect issue activity for the window and write it to `$RUN_DIR/issues.md`, wrapped in `<dataSource:issues>`.

Parameters: `RUN_DIR`, `LAST_WED`, `GH_HOST`, `REPOS`, `TEAM` (logins, may be empty), `OWNER` (may be empty), `ISSUE_TRACKER`.

`ISSUE_TRACKER` is `github` by default. If it names another tracker (Jira, Linear), run the equivalent queries with that tracker's CLI or MCP tool and capture the same fields; write a `TODO` if no tool is available.

## Commands

Scope the search to the team's repos (`--repo` per entry in `REPOS`) or, in team mode, to the team's owner (`--owner`). Run the queries in parallel; raw output goes to `$RUN_DIR/raw/`.

```bash
RAW="$RUN_DIR/raw"; mkdir -p "$RAW"; export GH_HOST
REPOS=(acme/studio acme/infra); SCOPE=(); for R in "${REPOS[@]}"; do SCOPE+=(--repo "$R"); done
OWN=(); [ -n "$OWNER" ] && OWN=(--owner "$OWNER")   # arrays work in bash and zsh
gh search issues 'reason:completed' "${SCOPE[@]}" "${OWN[@]}" --closed ">=$LAST_WED" \
  --json number,title,url,repository,author,assignees,closedAt,labels --limit 200 > "$RAW/issues-closed.json" &
gh search issues 'linked:pr' "${SCOPE[@]}" "${OWN[@]}" --state open --updated ">=$LAST_WED" \
  --json number,title,url,repository,author,assignees,updatedAt,labels --limit 200 > "$RAW/issues-inflight.json" &
wait
```

`issues-inflight.json` holds open issues with a linked PR that moved this week — work in progress. Milestone or project membership, when the repos use them, is useful theme context; fetch it per issue only for the closed set (`gh issue view <url> --json milestone,projectItems`).

For each closed issue, record the PRs that closed it, six at a time:

```bash
jq -r '.[].url' "$RAW/issues-closed.json" | xargs -P 6 -I{} gh issue view {} \
  --json url,closedByPullRequestsReferences --jq '{url, prs: [.closedByPullRequestsReferences[] | .url]}' > "$RAW/closed-by.jsonl"
```

If the field is unavailable, omit it rather than fabricating.

## Fields per issue

`repo`, `number`, `title`, `author` (reporter), `assignees`, `state`, `labels`, `milestone` when fetched, `closedAt` / `updatedAt`, and `closed_by_prs`.

## Attribution rules (record, do not attribute)

- The current assignee is not a reliable fixer signal: issues are often assigned to the reporter, a triager, or nobody.
- The fixer signals are a landed PR: the author of a PR in `closed_by_prs`, or the author of a PR or commit that references the issue (`Fixes #<n>`, the issue URL).
- Closed issues with no linked PR may have been fixed elsewhere or closed as duplicates; leave them unattributed.

## Return

Return `{ "path": "<RUN_DIR>/issues.md" }` and nothing else.
