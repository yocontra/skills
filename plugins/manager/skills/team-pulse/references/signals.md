# Signals: config and gather commands

Read at Step 2 (config) and Step 3 (gather). Every command is bounded
with `--limit` and `--json <fields>` and writes to `$RUN_DIR/<agent>.json`.

## Config

`~/.config/manager-plugin/team-pulse.json` pins what discovery would
otherwise redo each run. Every field is optional; a missing one takes
the default below. The skill writes the file only when run with
`--save-config`, which saves what this run discovered.

```json
{
  "org": "acme",
  "team": "platform",
  "repos": ["acme/billing-service", "acme/search-indexer"],
  "projects": [
    { "title": "Billing migration", "doc": "~/notes/planning/billing-migration.md",
      "repo": "acme/billing-service", "milestone": "Billing GA", "label": "billing" },
    { "title": "Search indexer v2", "doc": "https://docs.example.com/search-indexer-v2",
      "repo": "acme/search-indexer", "project": "acme/7" }
  ],
  "issue_tracker": "github",
  "incident_label": "incident",
  "oncall": { "tool": "pagerduty", "schedule_ids": ["P12345"] },
  "stuck_pr_ancient_days": 90
}
```

| Field | Default when absent |
|-------|---------------------|
| `org`, `team` | Roster from [team-list.md](../../../lib/team-list.md) |
| `repos` | Discovered: repos the team's PRs touched in the last 30 days (below) |
| `projects` | Discovery at Step 2; skipping is fine. `doc` is any project doc: design doc, RFC, one-pager, or tracking issue URL |
| `issue_tracker` | `github`. Jira or Linear only when the user names one. |
| `incident_label` | `incident`; no matches means no incidents section |
| `oncall` | No on-call section |

A project can link progress three ways, best first: a GitHub milestone,
a GitHub Project (`owner/number`), or a label. With none, fall back to
keyword matching in the linked repo.

## Repo discovery

```bash
printf '%s\n' "${LOGINS[@]}" | xargs -P 6 -I{} gh search prs --author "{}" \
  --updated ">=$(date -v-30d +%F 2>/dev/null || date -d '30 days ago' +%F)" \
  --json repository --limit 100 --jq '.[].repository.nameWithOwner' | sort | uniq -c | sort -rn | head -20
```

Keep repos with more than a one-off PR, and list the kept repos under the digest so a wrong one is easy to spot.

## Agents

Scale to what is configured: skip an agent whose source is absent rather
than spawning it to return `[]`.

| Agent | Data | Commands |
|-------|------|----------|
| `project-docs` | Milestone bullets, target dates, Status/Risks sections of each project doc | Read the local file, fetch via the doc tool the user named, or `gh issue view <n> --repo <r> --json title,body,state` for a tracking issue |
| `project-activity` | Progress per project in the window | Milestone: `gh api "repos/$REPO/milestones?state=all&per_page=50" --jq '.[] \| {title,open_issues,closed_issues,due_on,updated_at}'`. Closed work: `gh search issues --repo "$REPO" --milestone "$MS" --closed ">=$SINCE" --json number,title,closedAt,url --limit 100`. Merged PRs: `gh search prs --repo "$REPO" --merged --merged-at ">=$SINCE" --json number,title,url,closedAt,labels --limit 100`. Project: `gh project item-list <n> --owner <owner> --format json --limit 200 --jq '.items[] \| {title, status}'`. |
| `prs-open` | Open team PRs, with review and CI state | `gh search prs --author "$LOGIN" --state open --json number,title,isDraft,updatedAt,createdAt,url,repository --limit 50` per login; for non-draft PRs older than 3 days, `gh pr view <n> --repo <r> --json reviewRequests,reviewDecision,mergeable` and `gh pr checks <n> --repo <r> --json name,bucket --jq '[.[] \| select(.bucket=="fail")] \| length'` |
| `prs-needs-review` | PRs waiting on a team member's review | `gh search prs --review-requested "$LOGIN" --state open --json number,title,author,updatedAt,url,repository --limit 50` per login |
| `issues` | Open team issues with due dates, priority, milestones | `gh search issues --assignee "$LOGIN" --state open --json number,title,labels,createdAt,updatedAt,url,repository --limit 100` per login; search results carry no milestone, so for issues past the age threshold add `gh issue view <url> --json milestone` |
| `incidents` | Open incidents on team services | `gh search issues --label "$INCIDENT_LABEL" --state open --owner "$ORG" --json number,title,labels,createdAt,url,repository --limit 30`, or the incident tool the user names |
| `oncall` | Current and next-24h on-call | The paging tool the user configured (for PagerDuty, `pd` against the schedule IDs); walk the entries client-side for gaps |
| `ci-health` | Failing default-branch CI in the window | `gh run list --repo "$REPO" --branch "$DEFAULT" --status failure --created ">=$SINCE" --json databaseId,name,createdAt,url --limit 20` per repo |

Run per-login and per-repo loops in parallel inside one agent:

```bash
export RUN_DIR   # the sh -c child sees only exported variables
printf '%s\n' "${LOGINS[@]}" | xargs -P 8 -I{} sh -c \
  'gh search prs --author "{}" --state open --json number,title,isDraft,updatedAt,url,repository --limit 50 > "$RUN_DIR/prs-open-{}.json"'
```

Pass the roster to agents as a file in `$RUN_DIR` (`team.json`), not in
the prompt.

## Identity

Every GitHub query needs a login. The roster recipe resolves them; for a
member known only by name:

```bash
gh api "search/users?q=<url-encoded full name>" --jq '.items[0:5][].login'
```

Take the match whose recent repos overlap the team's; with no clear
match, leave the member out of GitHub queries and say so in the
digest. Jira, Linear, and paging tools use their own IDs; read them
from the config.
