# Review state: dismissing stale bot reviews and re-requesting review

Companion to [`monitor-pr`](../SKILL.md). The fix agents follow the same rules, in
[fix-pr.md](../../../workflows/monitor-pr/prompts/fix-pr.md) Steps 8 and 9.

## Dismissing a stale bot `CHANGES_REQUESTED`

A bot's `CHANGES_REQUESTED` pins the PR's `reviewDecision` to `CHANGES_REQUESTED` even after a
human approves, which blocks auto-merge. Fixing the findings does not clear it, and bots do not
reliably re-review. Dismiss one only when **all four** hold:

1. Its `state` is `CHANGES_REQUESTED`.
2. Its author is a bot or AI reviewer (`copilot-pull-request-reviewer[bot]`, `coderabbitai[bot]`,
   …). Never a human's review: a human re-reviews their own concern.
3. The PR has zero unresolved review threads.
4. Every `Bug` in that review is verified fixed at the current HEAD (you fixed it, or read the
   code and confirmed a later commit did), and every other finding is fixed or skipped with a
   recorded reason.

```bash
gh api --paginate "repos/{owner}/{repo}/pulls/<N>/reviews?per_page=100" \
  --jq '.[] | select(.state == "CHANGES_REQUESTED") | "\(.id)\t\(.user.login)\t\(.submitted_at)"'
gh api -X PUT "repos/{owner}/{repo}/pulls/<N>/reviews/<REVIEW_ID>/dismissals" \
  -f message="<factual reason>" -f event="DISMISS" --jq '.state'
```

The message is a log entry, not a reply: the fixing commit, what changed, how it was verified.
No thanks, no apology, no addressing the reviewer. Example: `Both findings fixed in 7a3b05af7,
pushed after this review of c7bf0cf49: execute.py now raises ValueError when get_execution
returns None. All threads resolved.`

If any condition fails, leave the review standing and say so in the report. A PR carrying both a
human and a bot `CHANGES_REQUESTED` is not dismissible; the review state alone does not say which
is which, so check the logins.

Dismissal can merge the PR at once: with a human approval underneath, auto-merge armed and CI
green, `reviewDecision` flips to `APPROVED` and the merge fires. Treat condition 4 accordingly.

## Re-requesting review

A reviewer who is not re-requested has no signal to come back. Re-request a human only when all
hold:

1. Every thread and review-body item from that reviewer is fixed, or verified already fixed at HEAD.
2. None of their threads is left open on purpose. Per reviewer: if A is done and B is not,
   re-request A only.
3. They are not already on the request list (a second request pings them again).
4. You pushed this round, or verified an earlier commit fixed their items.

```bash
gh api --paginate "repos/{owner}/{repo}/pulls/<N>/reviews?per_page=100" \
  --jq '[.[] | select(.state == "CHANGES_REQUESTED") | .user.login] | unique[]'
gh pr view <N> --json reviewRequests --jq '[.reviewRequests[].login] | join(",")'
gh api -X POST "repos/{owner}/{repo}/pulls/<N>/requested_reviewers" -f 'reviewers[]=<LOGIN>'
```

Bots re-review on push and are not re-requested this way.
