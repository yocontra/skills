---
name: gh-cli
description: Intercept GitHub operations and route them through the authenticated gh CLI. Prevents rate limits, private repo 404s, and incomplete API responses.
user-invocable: false
allowed-tools: Bash, Read, Grep, Glob
---

$ARGUMENTS

# gh CLI Router

When working with GitHub repositories, issues, PRs, or API data, always prefer the authenticated `gh` CLI over unauthenticated web fetches. This avoids:

- **Rate limits**: 60 req/hr unauthenticated vs 5,000 req/hr with `gh`
- **Private repo 404s**: unauthenticated fetches fail on private repos
- **Incomplete responses**: the GitHub web UI returns truncated data; the API returns everything

## When to use gh instead of WebFetch

| Task | Bad (web fetch) | Good (gh CLI) |
|------|-----------------|---------------|
| Read a file from GitHub | `WebFetch` on raw.githubusercontent.com | `gh api repos/OWNER/REPO/contents/PATH` |
| List repo contents | `WebFetch` on github.com tree page | `gh api repos/OWNER/REPO/git/trees/BRANCH --jq '.tree[].path'` |
| Read a PR | `WebFetch` on github.com/pulls/N | `gh pr view N --repo OWNER/REPO` |
| Read PR diff | Scraping the diff page | `gh pr diff N --repo OWNER/REPO` |
| Read PR comments | `gh api repos/OWNER/REPO/pulls/N/comments` | Same — no web equivalent is reliable |
| List issues | `WebFetch` on issues page | `gh issue list --repo OWNER/REPO` |
| Read issue | `WebFetch` on issue page | `gh issue view N --repo OWNER/REPO` |
| Search code | `WebFetch` on github.com/search | `gh search code "pattern" --repo OWNER/REPO` |
| Check workflow runs | `WebFetch` on actions page | `gh run list --repo OWNER/REPO` |
| Read workflow logs | Scraping the logs page | `gh run view RUN_ID --log --repo OWNER/REPO` |

## Common gh commands

### Repos
```bash
gh repo view OWNER/REPO                    # repo overview
gh repo clone OWNER/REPO -- --depth=1      # shallow clone
gh api repos/OWNER/REPO/git/trees/HEAD --jq '.tree[].path'  # list files
gh api repos/OWNER/REPO/contents/PATH --jq '.content' | base64 -d  # read file
```

### PRs
```bash
gh pr list --repo OWNER/REPO               # list open PRs
gh pr view N --repo OWNER/REPO             # PR details
gh pr diff N --repo OWNER/REPO             # PR diff
gh pr checks N --repo OWNER/REPO           # CI status
gh api repos/OWNER/REPO/pulls/N/comments   # PR comments
gh api repos/OWNER/REPO/pulls/N/reviews    # PR reviews
```

### Issues
```bash
gh issue list --repo OWNER/REPO            # list open issues
gh issue view N --repo OWNER/REPO          # issue details
gh issue list --label "bug" --repo OWNER/REPO  # filter by label
```

### Actions
```bash
gh run list --repo OWNER/REPO              # recent workflow runs
gh run view RUN_ID --repo OWNER/REPO       # run details
gh run view RUN_ID --log --repo OWNER/REPO # full logs
```

### API (anything not covered above)
```bash
gh api repos/OWNER/REPO/releases           # releases
gh api repos/OWNER/REPO/contributors        # contributors
gh api graphql -f query='{ ... }'           # GraphQL queries
```

## Anti-patterns to avoid

- **Don't use `/contents/` API to browse large directories** — it's paginated and slow. Clone shallowly instead.
- **Don't clone full repos for one file** — use `gh api repos/.../contents/PATH` to read individual files.
- **Don't use `gh api` without `--jq`** — raw JSON responses are verbose. Filter to what you need.
- **Don't forget `--repo OWNER/REPO`** — if you're not inside a clone, you need to specify the repo explicitly.

## Auth check

Before using `gh`, verify authentication:
```bash
gh auth status
```

If not authenticated, tell the user to run `! gh auth login` (the `!` prefix runs it interactively in the session).
