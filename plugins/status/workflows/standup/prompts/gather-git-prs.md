# Gather git and GitHub activity for a standup

Collect the user's own git and GitHub activity across every repo they touched, using the frozen dates and identity the launcher passed in. Use those literal values; do not recompute dates.

Parameters: `RUN_DIR`, `LAST_START`, `TODAY`, `TZ`, `GH_HOST`, `GH_LOGIN`, `GIT_EMAIL`, `REPO_ROOT` (may be `none`).

## Commands

Set `GH_HOST` in the environment for a non-github.com host. The queries are independent; run them in one Bash call so they share the shell:

```bash
RAW="$RUN_DIR/raw-git"; mkdir -p "$RAW"
export GH_HOST
gh search prs --author "$GH_LOGIN" --merged-at ">=$LAST_START" \
  --json number,title,url,repository,closedAt --limit 100 > "$RAW/merged.json" &
gh search prs --author "$GH_LOGIN" --created ">=$LAST_START" \
  --json number,title,url,repository,state,isDraft,createdAt --limit 100 > "$RAW/opened.json" &
gh search prs --author "$GH_LOGIN" --state open --updated ">=$LAST_START" \
  --json number,title,url,repository,isDraft,createdAt,updatedAt --limit 50 > "$RAW/updated-open.json" &
gh search commits --author "$GH_LOGIN" --author-date ">=$LAST_START" \
  --json sha,repository,commit,url --limit 100 > "$RAW/commits-remote.json" &
[ "$REPO_ROOT" != none ] && git -C "$REPO_ROOT" log --all --since="$LAST_START 09:00" \
  --author="$GIT_EMAIL" --no-merges --format='%h|%aI|%s' -n 200 > "$RAW/commits-local.txt" &
wait
```

- `merged.json` — PRs merged since `LAST_START`. For a merged PR, `closedAt` is the merge time (`gh search` exposes no `mergedAt`).
- `opened.json` — PRs opened since `LAST_START`, any state.
- `updated-open.json` — open PRs with activity in the window, including older PRs the user pushed review fixes to. This is the source for *Today*'s "pushed review-feedback fixes" lines.
- `commits-remote.json` — commits on default branches of every repo GitHub indexes. Commit search does not see feature branches, so it catches direct pushes, not branch work.
- `commits-local.txt` — every local branch of the current clone, including unpushed work.

The repos that appear across these files are the repos the user touched. For each one with a local clone the user mentioned, the same `git log` line may be run there too.

For each merged PR and each substantive commit, capture enough context to say what changed, bounded:

```bash
gh pr view <url> --json title,body,closingIssuesReferences --jq '{title, body: (.body // "" | .[0:600]), closes: [.closingIssuesReferences[].number]}'
git -C "$REPO_ROOT" show --stat --format='%B' <sha> | head -40
```

`closingIssuesReferences` links PRs to issues for the closed-issue gate.

## Rules

- Do not query reviews (`--reviewed-by`, `--review-requested`). Review counts are not tracked.
- Do not bucket into Last and Today here; record timestamps and let the compiler bucket them in local time (`TZ`).
- If a command fails (auth, network, no local repo), write a `TODO:` line naming it and continue.

## Output

Write one file, `$RUN_DIR/git-prs.md`, with commit data inside `<dataSource:git>` and PR data inside `<dataSource:github>`. Keep each PR to one line plus its trimmed body and closing issues; keep each commit to its subject, timestamp, repo, and a one-line stat. Return only the file path.
