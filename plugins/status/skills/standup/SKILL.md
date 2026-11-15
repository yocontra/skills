---
name: standup
effort: medium
description: Daily standup for Slack — your commits, PRs, issues, and meetings since the last standup, across every repo you touched, from git, GitHub, and an optional calendar.
user-invocable: true
---

$ARGUMENTS

# Daily standup

Build a Slack-ready standup from the user's own activity. Two sections:

- **Last:** 9am local yesterday → 9am local today (on Monday, from Friday 9am)
- **Today:** 9am local today → now, plus the top open items

Sources are git and GitHub across every repo the user touched in the window, not only the current one, plus the calendar when a calendar tool is connected. Gather all of them on every run, even when the user names only their commits: a standup built from git alone misses merged PRs and meetings. Nothing is asked up front; Step 2 lists the defaults used instead.

Output rules — Slack mrkdwn, item prefixes, ordering, an example — are in [formatting.md](references/formatting.md).

**PR reviews are not tracked.** Review volume, much of it bot PRs, made a review count meaningless as a measure of work. Do not query reviews and do not add a count, even when the user asks for one: say the standup leaves reviews out, give that reason, and build it without them. Review work worth reporting goes in as the specific thing it unblocked.

## Step 1: Freeze dates, identity, and the run directory

Run this once, in one Bash call, and reuse the printed literals everywhere after. System-injected dates are not reliable here; `date` is the source of truth. The `ago` helper works with both BSD and GNU `date`.

```bash
ago() { date -v-"$1"d +%F 2>/dev/null || date -d "$1 days ago" +%F; }
TODAY=$(date +%F); DOW=$(date +%u)
if [ "$DOW" -eq 1 ]; then LAST_START=$(ago 3); LOOKBACK=Friday; else LAST_START=$(ago 1); LOOKBACK=yesterday; fi
RUN_DIR=$(mktemp -d "${TMPDIR:-/tmp}/standup.XXXXXX")
GH_HOST=$(git remote get-url origin 2>/dev/null | sed -E 's#^(https?://|[^@]*@)##; s#[:/].*##'); GH_HOST=${GH_HOST:-github.com}
GH_LOGIN=$(GH_HOST=$GH_HOST gh api user --jq .login)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
echo "TODAY=$TODAY DAY=$(date +%A) TZ=$(date +%z) LAST_START=$LAST_START LOOKBACK=$LOOKBACK"
echo "RUN_DIR=$RUN_DIR GH_HOST=$GH_HOST GH_LOGIN=$GH_LOGIN REPO_ROOT=${REPO_ROOT:-none}"
echo "GIT_EMAIL=$(git config user.email)"
```

Shell state does not persist between Bash tool calls, so a `trap 'rm -rf "$RUN_DIR"' EXIT` here would only cover this one call and delete the directory before the agents use it. The exit checklist removes `RUN_DIR` instead. Pass these values to every agent as literal strings; an agent that recomputes dates can misread the day of week.

A user on GitHub Enterprise with a non-git cwd sets the host once (`GH_HOST=github.example.com`); everything else is discovered.

## Step 2: Defaults, not questions

Do not ask before gathering. Use what the conversation already says, else these defaults, and name the ones you used under the standup:

1. **Issue tracker** — `github` (GitHub Issues across the user's repos). If the user names Jira or Linear and a CLI or MCP tool for it is available, the gather agent runs the equivalent queries. `none` skips issue sections; the calendar is still gathered.
2. **Team names for meeting filtering** — none: include all work-related meetings.

Everything else — repos, login, PRs, issues — comes from git and `gh`.

## Step 3: Gather and compile

Read [shared/data-handoff.md](../../shared/data-handoff.md) once: agents write `<dataSource:*>`-wrapped files into `RUN_DIR` and return only paths.

### Fast path: dynamic workflow

When the `Workflow` tool is available:

1. Read [formatting.md](references/formatting.md) to pass as `formatGuide`.
2. Say the expected wall-clock (about 3 minutes), then launch:

   ```
   Workflow({ scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/standup/standup.js",
     args: { runDir, frozen: {lastStart, today, lookback, dayName, tz},
             env: {repoRoot, ghHost, ghLogin, userEmail},
             issueTracker, teams, formatGuide } })
   ```

   If `${CLAUDE_PLUGIN_ROOT}` does not expand inside `scriptPath`, resolve it with `echo "${CLAUDE_PLUGIN_ROOT}"` first. Check elapsed time against the estimate while waiting; at 2× with agents still running, read the workflow journal rather than waiting longer.
3. The workflow returns the standup text. Continue at Step 4.

### Prose path

Without the `Workflow` tool, run the same protocols by hand. Record `START=$(date +%s)` and put `elapsed Ns / budget 180s` in each agent prompt; the budget is advisory.

Spawn two gather agents in one message. Identity and repo detection stay with you (Step 1), not a third agent.

| Agent | Protocol | Writes |
|-------|----------|--------|
| Git and PRs | [gather-git-prs.md](../../workflows/standup/prompts/gather-git-prs.md) | `$RUN_DIR/git-prs.md` |
| Issues and calendar | [gather-issues-calendar.md](../../workflows/standup/prompts/gather-issues-calendar.md) | `$RUN_DIR/issues-calendar.md` |

Then read both files and compile with [compile-standup.md](../../workflows/standup/prompts/compile-standup.md) and [formatting.md](references/formatting.md). Check the draft once against the files with [verify-standup.md](../../workflows/standup/prompts/verify-standup.md); if it finds problems, fix the named items once and move on.

## Step 4: Humanize and deliver

Run the `humanizer` skill on the standup text when it is installed. Then show it in chat and copy it with the first clipboard tool that exists; if none does, the chat copy is the delivery.

```bash
clip() { if command -v pbcopy >/dev/null; then pbcopy; elif command -v wl-copy >/dev/null; then wl-copy; elif command -v xclip >/dev/null; then xclip -selection clipboard; else cat >/dev/null; fi; }
clip <<'STANDUP'
<standup text>
STANDUP
```

Do not write the standup to a file unless the user asks for one, and then only to the path they name.

If the calendar was unavailable, the Meetings lines carry a `TODO` placeholder for the user to fill in. Say so in one line.

## Exit checklist

Keep this list current. A text-only turn with an item still open is a progress report, not the end: continue, or name the blocker.

- [ ] Standup shown in chat and copied to the clipboard (or written only to the path the user named)
- [ ] Every agent or workflow this run started has returned; stop any still running with `TaskStop`
- [ ] `rm -rf "$RUN_DIR"` — the run directory from Step 1, and nothing else
- [ ] No scratch, draft, or JSON files left in the repo or the working directory

## Prerequisites

`gh` authenticated for the host (`gh auth status`). A calendar is optional: any calendar MCP server or CLI works (on macOS, `icalBuddy`). If a command is blocked by permissions or a sandbox, ask the user to allow it rather than changing settings yourself.
