# GitHub GraphQL API Reference

Use `gh api graphql` for operations the REST API doesn't support, like resolving review threads, bulk mutations, and complex queries.

## Basics

```bash
# Simple query
gh api graphql -f query='{ viewer { login } }'

# With variables (string)
gh api graphql -f query='...' -f owner=my-org -f repo=my-repo

# With variables (int/bool -- use -F for non-string)
gh api graphql -f query='...' -F pr=123 -F includeResolved=true

# From a file
gh api graphql --input query.graphql
```

## Pull Request Queries

### Get PR details with reviews and checks

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      title
      state
      author { login }
      reviewDecision
      reviews(last: 10) {
        nodes {
          state
          author { login }
          body
          submittedAt
        }
      }
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              state
              contexts(first: 20) {
                nodes {
                  ... on CheckRun {
                    name
                    conclusion
                    detailsUrl
                  }
                  ... on StatusContext {
                    context
                    state
                    targetUrl
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}' -f owner=OWNER -f repo=REPO -F pr=123
```

### Read PR feedback (paginated, newest-first, full coverage)

The canonical pattern for any skill that addresses review feedback. **Three rules** every caller follows:

1. **Always paginate.** `last:100` / `first:100` silently truncates busy PRs — older threads vanish. Use `--paginate` with a cursor.
2. **Always sort newest first.** Surface recent feedback first; the user reads top-down.
3. **Read all three feedback sources.** Reviewers and bots post in different places:
   - **Review threads** — inline comments on a specific line (GraphQL `reviewThreads`)
   - **PR-level reviews** — overall reviews and bot summaries (`/pulls/<N>/reviews`)
   - **Issue-style comments** — top-level comments not attached to any line (`/issues/<N>/comments`)

Skipping any source silently drops feedback.

#### 1. Review threads — paginated

`gh api graphql --paginate` walks `pageInfo.hasNextPage` automatically. The query MUST declare `$endCursor: String` and pass it to `after:`.

```bash
gh api graphql --paginate -f query='
query($owner: String!, $repo: String!, $pr: Int!, $endCursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          diffSide
          comments(first: 100) {
            nodes {
              id
              body
              author { login }
              createdAt
              url
            }
          }
        }
      }
    }
  }
}' -f owner=OWNER -f repo=REPO -F pr=123 \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[]' \
  | jq -s '
      map(select(.isResolved == false))
      | sort_by([.comments.nodes[].createdAt] | max // "")
      | reverse
    '
```

What it returns: every unresolved thread, oldest comment to newest within each thread, threads sorted by **most recent activity first**.

> A single thread with >100 comments is rare; if you hit it, fetch that thread's comments separately with cursor pagination on the `comments` field.

#### 2. PR-level reviews

```bash
gh api --paginate "repos/$OWNER/$REPO/pulls/$PR_NUM/reviews?per_page=100" \
  | jq -s 'add | sort_by(.submitted_at) | reverse'
```

AI review bots and many human reviewers post overall PR reviews here — concerns that aren't tied to a line. Sort post-hoc; the REST endpoint has no `sort` parameter. `--paginate` prints one JSON array per page, so `jq -s 'add'` joins them before sorting.

#### 3. Issue-style PR comments

```bash
gh api --paginate "repos/$OWNER/$REPO/issues/$PR_NUM/comments?per_page=100" \
  | jq -s 'add | sort_by(.created_at) | reverse'
```

This endpoint ignores `sort` and `direction` and always returns oldest first, so sort post-hoc.

These are top-level "what about X?" comments and ad-hoc replies that never become a review thread. Easy to forget — they're a different REST endpoint.

#### Outdated threads — surface, do not drop

`isOutdated=true` means the referenced line moved or was deleted since the comment was posted. **The original concern often still applies** — the code may have been moved, not addressed.

Rule for every caller:

- Keep outdated threads in the result set.
- Tag them visibly (e.g. `[outdated — verify still applicable]`) when surfacing to a fix agent or user.
- After verification: if still applicable, fix the new location; if truly addressed, resolve via `resolveReviewThread`.
- Never silently filter `isOutdated=true` out of the feedback list.

## Review Thread Mutations

### Resolve a thread

```bash
gh api graphql -f query='
mutation($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread {
      id
      isResolved
      resolvedBy { login }
    }
  }
}' -f threadId=PRRT_XXXXX
```

### Unresolve a thread

```bash
gh api graphql -f query='
mutation($threadId: ID!) {
  unresolveReviewThread(input: { threadId: $threadId }) {
    thread { id isResolved }
  }
}' -f threadId=PRRT_XXXXX
```

### Reply to a thread

```bash
gh api graphql -f query='
mutation($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: {
    pullRequestReviewThreadId: $threadId
    body: $body
  }) {
    comment { id body author { login } }
  }
}' -f threadId=PRRT_XXXXX -f body="Fixed in latest commit."
```

### Reply and resolve in one script

```bash
THREAD_ID=PRRT_XXXXX
REPLY="Addressed in latest push."

# Reply
gh api graphql -f query='
mutation($tid: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $tid, body: $body }) {
    comment { id }
  }
}' -f tid="$THREAD_ID" -f body="$REPLY"

# Resolve
gh api graphql -f query='
mutation($tid: ID!) {
  resolveReviewThread(input: { threadId: $tid }) {
    thread { isResolved }
  }
}' -f tid="$THREAD_ID"
```

## Review Mutations

### Submit a review

```bash
gh api graphql -f query='
mutation($prId: ID!, $body: String!, $event: PullRequestReviewEvent!) {
  addPullRequestReview(input: {
    pullRequestId: $prId
    body: $body
    event: $event
  }) {
    pullRequestReview { id state }
  }
}' -f prId=PR_NODE_ID -f body="LGTM" -f event=APPROVE
```

Events: `APPROVE`, `REQUEST_CHANGES`, `COMMENT`

### Dismiss a review

```bash
gh api graphql -f query='
mutation($reviewId: ID!, $message: String!) {
  dismissPullRequestReview(input: {
    pullRequestReviewId: $reviewId
    message: $message
  }) {
    pullRequestReview { id state }
  }
}' -f reviewId=PRR_XXXXX -f message="Requirements changed"
```

## Common Patterns

### Get PR node ID (needed for some mutations)

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) { id }
  }
}' -f owner=OWNER -f repo=REPO -F pr=123 \
  --jq '.data.repository.pullRequest.id'
```

### Search issues and PRs

```bash
gh api graphql -f query='
query($q: String!) {
  search(query: $q, type: ISSUE, first: 20) {
    nodes {
      ... on PullRequest {
        number
        title
        state
        repository { nameWithOwner }
      }
      ... on Issue {
        number
        title
        state
        repository { nameWithOwner }
      }
    }
  }
}' -f q="org:my-org is:pr is:open review-requested:@me"
```

### Pagination with cursors

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequests(first: 50, after: $cursor, states: OPEN) {
      pageInfo { hasNextPage endCursor }
      nodes { number title }
    }
  }
}' -f owner=OWNER -f repo=REPO -f cursor=CURSOR_VALUE
```

## ID Prefixes

GitHub GraphQL node IDs have type prefixes:

| Prefix | Type |
|--------|------|
| `PR_` | PullRequest |
| `PRR_` | PullRequestReview |
| `PRRC_` | PullRequestReviewComment |
| `PRRT_` | PullRequestReviewThread |
| `I_` | Issue |
| `IC_` | IssueComment |
| `R_` | Repository |
| `MDQ_` | MergeQueue |
