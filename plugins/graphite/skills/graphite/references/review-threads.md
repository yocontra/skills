# Review threads over GraphQL

Back to [SKILL.md](../SKILL.md). These work for any PR, including PRs in a Graphite
stack. `{owner}` and `{repo}` are filled in by `gh` from the current clone.

## Fetch reviews and unresolved threads

```bash
gh api graphql -F owner='{owner}' -F repo='{repo}' -F number=PR_NUMBER -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviews(last: 20) {
          nodes { author { login } state body submittedAt }
        }
        reviewThreads(first: 100) {
          nodes {
            id isResolved isOutdated path line
            comments(first: 50) {
              nodes { body author { login } createdAt }
            }
          }
        }
      }
    }
  }
' --jq '.data.repository.pullRequest.reviewThreads.nodes[]
        | select(.isResolved == false)
        | {id, path, line, isOutdated,
           comments: [.comments.nodes[] | {author: .author.login, body: .body[:400]}]}'
```

Thread IDs are `PRRT_`-prefixed node IDs. For a whole stack, list branches with
`gt log short`, map each to a PR number with `gh pr view <branch> --json number --jq .number`,
and run the query per PR.

## Resolve one thread

```bash
gh api graphql -F threadId='PRRT_xxxxxxxxxxxx' -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread { id isResolved }
    }
  }
'
```

## Resolve every unresolved thread on a PR

Only after each one has actually been addressed.

```bash
gh api graphql -F owner='{owner}' -F repo='{repo}' -F number=PR_NUMBER -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) { nodes { id isResolved } }
      }
    }
  }
' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | .id' \
| while read -r id; do
    gh api graphql -F threadId="$id" -f query='
      mutation($threadId: ID!) {
        resolveReviewThread(input: { threadId: $threadId }) { thread { id isResolved } }
      }
    '
  done
```

Resolve silently. Never post a "resolved", "done", or "fixed" comment in place of resolving.
