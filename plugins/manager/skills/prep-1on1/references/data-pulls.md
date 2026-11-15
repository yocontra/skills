# Data-pull mechanics

Tool-level detail for Step 2 (calendar window) and Step 3 (artifact pulls).
Read it when you reach the step that needs it.

## Artifact pulls (Step 3)

Every command below is bounded (`--limit`, `--json <fields>`) and writes
to `$RUN_DIR/<agent>.json`. `$LOGIN` is the target's GitHub login (or the
user's own for upward pulls), `$SINCE` is `$WINDOW_START`. Use flags, not
positional queries: `gh search prs "author:x created:>=..."` gets mangled
around `>=`.

**Repo discovery.** Pulls are cross-repo by default. `gh search` already
spans every repo the token can see; to name the repos in the packet, or
to run per-repo calls such as `gh pr checks`, list them once:

```bash
gh search prs --involves "$LOGIN" --updated ">=$SINCE" \
  --json repository --limit 200 --jq '.[].repository.nameWithOwner' | sort -u
```

Add any local clones the user names (`git -C <path> remote get-url origin`).
Restrict to an org with `--owner <org>` when the user's account spans
unrelated orgs.

### Downward shape — the target's work

| Agent | Command |
|-------|---------|
| `gh-authored` | `gh search prs --author "$LOGIN" --created ">=$SINCE" --json number,title,state,isDraft,createdAt,closedAt,url,repository --limit 100` |
| `gh-reviewed` | `gh search prs --reviewed-by "$LOGIN" --updated ">=$SINCE" --json number,title,author,state,updatedAt,url,repository --limit 100` |
| `gh-waiting` | Open PRs by the target that wait on review or CI: `gh search prs --author "$LOGIN" --state open --json number,title,updatedAt,url,repository --limit 50`, then for each, `gh pr checks <n> --repo <repo> --json name,bucket --jq '[.[] \| select(.bucket == "fail" or .bucket == "pending")]'` (skip drafts). |
| `issues` | Closed: `gh search issues --assignee "$LOGIN" --closed ">=$SINCE" --json number,title,url,closedAt,repository --limit 100`. Filed: `gh search issues --author "$LOGIN" --created ">=$SINCE" --json number,title,state,url,repository --limit 100`. Open: `gh search issues --assignee "$LOGIN" --state open --json number,title,updatedAt,labels,url,repository --limit 100` (search results carry no milestone; `gh issue view <url> --json milestone` for the few that become topics). One agent runs all three. |
| `shared-meetings` | Optional, calendar only: the user's meetings in the window that list the target, ≥ 4 humans. |

Jira or Linear replace the `issues` row only when the user names that
tracker; use its CLI or MCP tool with the same three questions.

For indirect reports (`downward:2+`), group PRs into themes ("deep on X")
rather than listing them.

### Upward shape — the user's own work, as priming

| Agent | Data |
|-------|------|
| `xfunc-meetings` | Cross-functional meetings the user attended — see **Xfunc meetings** below. Calendar only; skip without one. |
| `my-docs` | The user's plans, design docs, RFCs, retros — see **Docs activity pull** below. |
| `big-shipping` | Team members' merged PRs, per roster login: `gh search prs --author "$MEMBER" --merged --merged-at ">=$SINCE" --json number,title,url,repository,closedAt --limit 50`. Keep large, customer-facing, or other-team-repo work. |
| `cross-team-blocks` | Team PRs whose requested reviewer is outside the team and pending ≥ 3 days (`gh search prs --author "$MEMBER" --state open --review required --json number,title,url,repository,updatedAt --limit 50`), and team-filed issues assigned outside the team, open ≥ 14 days. |
| `escalations` | Open incidents for team services: GitHub issues with an incident label (`gh search issues --label incident --state open --owner <org> --json number,title,url,createdAt --limit 30`) or the incident/on-call tool the user names. Skip when there is neither. |

Trim by altitude: `upward:2` drops nothing; `upward:3+` keeps only
`xfunc-meetings`, `my-docs`, and headline `big-shipping`.

Run per-login loops in parallel inside one agent, bounded:

```bash
export SINCE RUN_DIR   # the sh -c child sees only exported variables
printf '%s\n' "${LOGINS[@]}" | xargs -P 6 -I{} sh -c \
  'gh search prs --author "{}" --merged --merged-at ">=$SINCE" --json number,title,url,repository --limit 50 > "$RUN_DIR/ship-{}.json"'
```

## Calendar: finding the last 1:1 (Step 2)

Use whatever calendar tool the user has connected (an MCP server, a
CLI, an exported `.ics`). If none exists, use the 14-day default from
Step 2, flag it as artificial, and skip this section.

**Range caps.** Many calendar APIs reject long ranges (31 days is a
common cap). Walk back in chunks of 30 days. **Issue all 6 chunks (180
days) in a single assistant message** — the harness dispatches them
concurrently. Then pick the most recent strictly-past match from the
union.

```
# Emit all six in ONE message — concurrent dispatch:
# chunk 1: today minus 30d → today
# chunk 2: today minus 60d → today minus 30d
# chunk 3: today minus 90d → today minus 60d
# ...up to 180d
```

Sequential early-exit was ~6× slower on a long-gap 1:1 for no quality
gain — fanning out adds 5 cheap calls and bounds latency to the
slowest single chunk.

**Title matching.** Case-insensitive patterns a 1:1 title should hit:

```
\b1:1\b                    matches "1:1", "Sam 1:1 Ash"
\b1on1\b                   matches "1on1"
<name>\s+\|\s+<name>       matches "Sam S | Ash" (note the spaces!)
<name>\s+&\s+<name>        matches "Sam & Ash"
<name>\s+<->\s+<name>      matches "Sam <-> Ash"
<name>\s+<>\s+<name>       matches "Sam <> Ash" (single angles)
<name>\s+/\s+<name>        matches "Sam / Ash"
```

Avoid loose `|` matching: "Foo | Bar | Baz Sync" false-positives
without the surrounding-space anchor.

**Picking the window start.** Sort matches by start time descending.
The most recent **strictly past** meeting is the last 1:1. Compare
the start time against the current **datetime** (`NOW`), not just
`$TODAY` as a date — otherwise a 1:1 that already happened *earlier
today* satisfies `< $TODAY` and silently becomes `$WINDOW_START`,
yielding a zero-length window.

```
candidates = [m for m in matches if m.start_time < NOW]   # NOW = datetime, not date
last_1on1 = max(candidates, key=lambda m: m.start_time)
WINDOW_START = last_1on1.start_time.date()                 # YYYY-MM-DD
```

If today's 1:1 with the same person already happened, the right window
covers the gap between the *prior* meeting and today's — not the
(empty) gap from today to today.

## Xfunc meetings (`xfunc-meetings`, upward shape)

1. List the user's meetings from `$WINDOW_START` to `$TODAY`, with
   attendance status. Apply the same chunking above if the window
   exceeds the tool's range cap.
2. Get the user's team set from
   [team-list.md](../../../lib/team-list.md) (direct reports + the user).
3. **Solo manager / no-reports case.** If the user has no direct
   reports, the team set is just the user. Every accepted meeting
   with at least one other human becomes "xfunc" by definition (the
   filter trivially passes). In this case, don't surface all of them
   — boost-by-keywords (step 5) becomes the primary filter, and cap
   surfaced meetings at 5.
4. Filter:
   - User accepted (or organized) — drop declines / unanswered.
   - Drop personal blocks (`block`, `lunch`, `focus`, `deep work`,
     no attendees).
   - Drop 1:1s (≤ 2 humans after stripping rooms / video bridges).
   - Drop standing all-team syncs (every human attendee is in the
     team set — only meaningful when team set has > 1 member).
   - **Keep meetings with at least one human attendee outside the
     team set.**
5. Boost titles matching `review`, `sync` (with non-team), `working
   group`, `quarterly`, `OKR`, `kickoff`, `decision`, `planning`, `roadmap`,
   `strategy`, `architecture`, names of other teams.
6. Draft 3-5 into Decisions or FYI: "Platform Architecture Review last
   Tuesday: likely decision-needed on <topic>"; mark a guess as `TODO:`
   for the user to confirm or drop.

## Docs activity pull (`my-docs`, upward shape)

Read-only. Sources, in order: a path or doc tool the user named, the
current repo's `docs/` and design-doc directories, then local notes.

*Primary — the user's own work* (always include):

1. Local Markdown: `find <dirs> -name '*.md' -newermt "$WINDOW_START" | head -50`.
   In a git repo, prefer authorship over mtime:
   `git log --author="$(git config user.email)" --since="$WINDOW_START" --name-only --pretty=format: -- '*.md' | sort -u | head -50`.
   A doc tool the user named: its "recently edited by me" query, filtered
   to the window.
2. Skip noise: typo fixes, title tweaks, scratch meeting notes. Keep
   plans, design docs, proposals, retros, planning drafts, RFCs.
3. Surface 3-5 with title, last-edit date, one-line "what it is" hint.

*Secondary — shared boss activity* (only when relevant):

The boss works on lots of stuff unrelated to the user. Don't surface
all of it. Keep only docs where both the user *and* the boss edited in
the window (in git: both appear in `git log --format='%ae' -- <file>`
since `$WINDOW_START`). Surface at most 1-2 shared docs.

## Identity quirks

- **`$GH_LOGIN` (GitHub username) ≠ email prefix.** Often similar, but
  not always. When `gh search` returns "user not found":
  ```bash
  gh api '/search/users?q=<full+name+url+encoded>' --jq '.items[0:5][].login'
  ```
  Take the match whose name and recent repos fit the roster, and name
  it in the summary so a wrong match is easy to spot.
- **Issue-tracker identities.** Jira and Linear key users by email or
  account ID, not GitHub login. Use the roster email; if there is
  none, skip the tracker pull and say so in the summary.

## Issue-tracker and calendar caveats

**Triage-queue inflation.** "All open issues assigned to X" often
includes triage or rotation queues. A "600 open issues" count is a
backlog signal, not a 1:1 topic. Filter:

- Drop issues older than 30 days unless they show recent activity, or
- Filter to a priority cutoff (P1/P2 or the tracker's equivalent), or
- Cross-reference against the window's PR titles/bodies to keep
  issues the target is actively touching.

Surface "stuck issues" or "reopened issues" — never raw open count.

**You only see your own calendar.** A calendar tool is scoped to your
events (or events you're a delegate on). For downward 1:1s, this means
you can only detect meetings the target attended *with you*
(`shared-meetings`). For full target-side visibility into their xfunc,
ask in the meeting — that's a topic, not data. For upward 1:1s, the
user *is* the relevant calendar; this caveat doesn't bind.
