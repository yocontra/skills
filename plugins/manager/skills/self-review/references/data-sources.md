# Data sources — where the year's work lives

Pull from all of these in parallel. Each answers a different question.
Agents write their output to the run's `$RUN_DIR` and return only the
path.

## 1. Project docs the user owns

Design docs, RFCs, one-pagers, tracking issues: whatever the team uses.
These are the primary record of project ownership and scope. Look
where they usually live: a doc tool or path the user named, the repos'
`docs/` directories, and local Markdown under `~/notes` or the current
checkout. Note in Assumptions which places were searched.

1. Search for the project names in the request and the top PR
   clusters from section 3, plus title searches for common doc types (for example
   `"design doc"`, `"RFC"`, `"one-pager"`). Run
   several targeted searches rather than one broad one, each bounded
   (`grep -rli --include='*.md' '<project>' <dir> | head -20`).
2. For each candidate, read the owner field near the top. Keep the ones
   the user owns. Note scope, dates, partner teams, and the change log
   (which often records what shipped vs. slipped).

Batch the reads, about 8 per message.

## 2. Weekly status notes

A team status archive (if one exists) is the best month-by-month record
of what the user personally reported. It is usually large and
team-wide, so delegate extraction: "read these notes, return only
<user>'s entries, grouped by month, for the cycle window, each quoted
briefly so the project and month can be confirmed."

## 3. GitHub PRs and issues — every repo, by month

This gives the concrete monthly log and the PR counts. Search by author
across GitHub rather than one repo: it finds PRs in the canonical
upstream repos even when the local clone is a personal fork (a fork
usually has zero PRs, which is the classic undercount).

**Repos touched:**

```bash
gh search prs --author "$ME" --merged --merged-at "$CYCLE_START..$CYCLE_END" \
  --json repository --limit 1000 --jq '.[].repository.nameWithOwner' | sort | uniq -c | sort -rn
```

**Per-quarter crawl.** `gh search` caps at 1000 results per query, so
each agent takes one quarter of the cycle (split to months if a quarter
returns exactly 1000):

```bash
gh search prs --author "$ME" --merged --merged-at "$Q_START..$Q_END" \
  --json number,title,url,repository,closedAt,labels --limit 1000
```

Each quarter agent:
- groups the quarter's merged PRs by month,
- reads bodies of the substantial ones only
  (`gh pr view <n> --repo <r> --json body --jq .body | head -60`),
- returns **3-6 high-level, non-technical outcomes** per month,
- filters minor work hard (small fixes, refactors, test tweaks,
  dependency bumps, CI, one-liners),
- reports the merged-PR count it saw per month.

Tell each agent: this is for a non-technical performance review; report
tangible outcomes, not implementation detail; err toward cutting
anything small.

**Exact counts per month** (used by verification; not capped by
`--limit`):

```bash
gh api -X GET search/issues \
  -f q="type:pr author:$ME is:merged merged:<YYYY-MM-01>..<YYYY-MM-last-day>" \
  --jq .total_count
```

**Issues** the user closed or filed give scope, partner teams, and the
milestones and projects the work belonged to:

```bash
gh search issues --assignee "$ME" --closed "$CYCLE_START..$CYCLE_END" \
  --json number,title,url,repository,labels --limit 500 > "$RUN_DIR/issues-closed.json"
# search results carry no milestone; fetch it per issue, six at a time
jq -r '.[].url' "$RUN_DIR/issues-closed.json" | xargs -P 6 -I{} gh issue view {} --json url,milestone
gh search issues --author "$ME" --created "$CYCLE_START..$CYCLE_END" \
  --json number,title,url,repository,state,labels --limit 500
```

Use Jira or Linear only if the user names it as their tracker.

## 4. Project READMEs

Before describing a project, read its README so the description is
accurate: the one line on what it is and why it matters, plus concrete,
verifiable facts (language, what it replaced, any benchmark or scale
number). These also anchor the verification pass.

## Parallelization

The PR crawl is the bottleneck: one agent per quarter, all spawned in a
single message. Doc reads batch about 8 per message. Everything in
Step 2 of the skill runs concurrently.
