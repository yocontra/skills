# Gather calendar and issue data for a standup

Collect the user's meetings and issues using the frozen dates and identity the launcher passed in. Use those literal values; do not recompute dates.

Parameters: `RUN_DIR`, `LAST_START`, `TODAY`, `TZ`, `GH_HOST`, `GH_LOGIN`, `ISSUE_TRACKER`, `TEAMS` (may be empty).

## Calendar

Use whatever calendar tool is connected: a calendar MCP server, a CLI, or on macOS `icalBuddy`. If none is available, write `TODO: calendar unavailable — fill in meetings manually` and continue.

With `icalBuddy`:

```bash
RAW="$RUN_DIR/raw-cal"; mkdir -p "$RAW"
icalBuddy -nc -nrd -ea -b '- ' -ps '| - |' -iep 'title,datetime,attendees' \
  eventsFrom:"$LAST_START 09:00:00" to:"$TODAY 08:59:59" | head -100 > "$RAW/cal-last.txt" &
icalBuddy -nc -nrd -ea -b '- ' -ps '| - |' -iep 'title,datetime,attendees' \
  eventsFrom:"$TODAY 09:00:00" to:"$TODAY 23:59:59" | head -100 > "$RAW/cal-today.txt" &
wait
```

The two ranges match the standup's *Last* and *Today* windows. On Monday, `LAST_START` is Friday, so *Last* runs from Friday 9am through the weekend. Leave out `-f`: it adds ANSI color codes to the file.

Drop before writing:

- Cancelled events — title starts with `Canceled:` / `Cancelled:`, or status `CANCELLED`.
- Tentative events — when the tool exposes the user's own response. If it does not, keep them and add `TODO: tentative filter unavailable`.
- All-day blocks, lunch, and personal holds.

## Issues

`ISSUE_TRACKER` is `github` by default: GitHub Issues across every repo, not only the current one. `none` skips this section. If it names another tracker (Jira, Linear), run the equivalent queries with that tracker's CLI or MCP tool, or write a `TODO` if no tool is available.

```bash
RAW="$RUN_DIR/raw-issues"; mkdir -p "$RAW"
export GH_HOST
gh search issues 'reason:completed' --assignee "$GH_LOGIN" --closed ">=$LAST_START" \
  --json number,title,url,repository,closedAt --limit 50 > "$RAW/closed.json" &
gh search issues --assignee "$GH_LOGIN" --state open --sort updated \
  --json number,title,url,repository,labels,updatedAt --limit 30 > "$RAW/open.json" &
wait
```

- **Closed in window:** keep issues whose `closedAt` falls in the window in local time (`TZ`). For each, find the PR that closed it, a few at a time:

  ```bash
  jq -r '.[] | .url' "$RAW/closed.json" | xargs -P 6 -I{} sh -c \
    'gh issue view {} --json number,url,closedByPullRequestsReferences --jq "{url, prs: [.closedByPullRequestsReferences[] | {number, url}]}"' > "$RAW/closed-by.jsonl"
  ```

  Emit a closed issue only when both the in-window close and a closing PR are confirmed. No PR means it may be someone else's fix, a duplicate, or won't-fix — skip it.
- **Open:** priority comes from labels (`P1`, `priority:high`) and milestones when the repo uses them. Keep the top few for the compiler; the standup shows at most 3–4.

## Output

Write one file, `$RUN_DIR/issues-calendar.md`, with meetings inside `<dataSource:calendar>` and issues inside `<dataSource:issues>`. Return only the file path.
