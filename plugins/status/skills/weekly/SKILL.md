---
name: weekly
effort: medium
description: Weekly status for management — what the team shipped since last Wednesday, grouped by author, across the team's repos, from GitHub PRs, git, and issues. Markdown with impact bullets; no links, PR numbers, or hashes.
user-invocable: true
---

$ARGUMENTS

# Weekly status

Build an upward status report for a semi-technical manager: what the team shipped since last Wednesday, one section per author, a few impact bullets each.

The deliverable has one `**[II]**` initials header per person who shipped in the window, with one-line bullets under it. Each bullet states the impact of the work (a feature shipped, a significant bug fixed), not a commit: several commits collapse into one bullet, and chores drop out. A request for what "the team" or "the group" delivered still gets this per-author shape — it means every author, not one merged list — so do not ask whether to break it out by person.

Output is Markdown that pastes into a doc, chat, or email: bold initials headers and `- ` bullets, and nothing else — no links, URLs, PR numbers, or commit hashes, even though the gathered data carries them. When you cannot gather data and describe the report instead, state all three rules: Markdown without links, PR numbers, or hashes; grouped by author; one bullet per feature or significant fix, not per commit. Layout and examples are in [formatting.md](references/formatting.md).

## The window is the PR merge date

`LAST_WED`..`TODAY` means work that reached the default branch this week: PRs whose merge time falls in the window. It is not a git-date window. `git log --since/--until` filters on committer date, which a rebase rewrites, so it tracks neither when work was written nor when it shipped; a PR merged Thursday can carry commits dated the week before. Git dates only list names and catch direct pushes; they never decide what counts. [gather-git-prs.md](../../workflows/weekly/prompts/gather-git-prs.md) has the full rule.

A past week like "week of 8/12" is the window ending that day when it falls on a Wednesday — the report filed that day. Any other weekday means the window ending on the next Wednesday after it; state the window you used.

## Step 1: Freeze the window and the run directory

Run once, in one Bash call; reuse the printed literals.

```bash
ago() { date -v-"$1"d +%F 2>/dev/null || date -d "$1 days ago" +%F; }
TODAY=$(date +%F); DOW=$(date +%u)
if [ "$DOW" -eq 3 ]; then BACK=7; elif [ "$DOW" -gt 3 ]; then BACK=$((DOW - 3)); else BACK=$((DOW + 4)); fi
LAST_WED=$(ago "$BACK")
RUN_DIR=$(mktemp -d "${TMPDIR:-/tmp}/weekly.XXXXXX")
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
GH_HOST=$(git remote get-url origin 2>/dev/null | sed -E 's#^(https?://|[^@]*@)##; s#[:/].*##'); GH_HOST=${GH_HOST:-github.com}
GH_REPO=$(GH_HOST=$GH_HOST gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null)
echo "LAST_WED=$LAST_WED TODAY=$TODAY RUN_DIR=$RUN_DIR GH_HOST=$GH_HOST GH_REPO=${GH_REPO:-none} REPO_ROOT=${REPO_ROOT:-none}"
```

Shell state does not persist between Bash tool calls, so a `trap 'rm -rf "$RUN_DIR"' EXIT` would only cover this one call and delete the directory before the agents use it. The exit checklist removes `RUN_DIR` instead.

## Step 2: Resolve scope — repos, team, config

Read `.claude/config/weekly-status.yaml` in the repo root if it exists (legacy: `.claude/weekly-status.json`). With a config, ask nothing. The skill reads this file; it never creates or edits it unless the user asks.

```yaml
repos: [acme/studio, acme/infra]   # default: the current repo
team: [jsmith, achen, bmartinez]   # GitHub logins; default: everyone who merged into the repos
owner: acme                        # optional: limit team searches to one org
metrics_command: "scripts/team-stats.sh"
issue_tracker: github              # github | none | a tracker the user names (Jira, Linear)
additional_context:
  JS: ["Drafting Q3 plan with leads"]
```

Without a config, ask nothing. Use what the conversation names, else these defaults, and state them under the report:

1. **Team** — GitHub logins or a GitHub team (`gh api orgs/ORG/teams/TEAM/members --jq '.[].login'`) when the user names one; else everyone who merged here. With a team, the report covers each member's PRs in every repo they merged into, not only the current one.
2. **Extra repos** — only the ones the user names; else the current repo.
3. **Metrics command** and **per-person context** (in-progress work not in GitHub) — none unless the user gives them.

**Issue tracker:** the config value, else `github` when the repos have issues enabled (`gh repo view R --json hasIssuesEnabled --jq .hasIssuesEnabled`), else `none`. Jira or Linear only when the user names one and a tool for it is available.

**Authors:** the union of PR authors merged in the window and direct pushers in the local clone. Neither source alone is complete: `git log` misses work that landed as a squash commit credited to the merger, and the PR list misses direct pushes. Drop bots (`*[bot]`, `*-autofix`, service accounts). Initials come from the display name ("Jane Smith" → JS); disambiguate collisions with a third letter.

```bash
REPOS=("$GH_REPO")   # or the config's repos; an array works in bash and zsh
for R in "${REPOS[@]}"; do
  gh pr list --repo "$R" --state merged --search "merged:>=$LAST_WED" --json author --limit 300 \
    --jq '.[].author | (.name // "") + "\t" + .login'
done | sort -u > "$RUN_DIR/authors.tsv"
git -C "$REPO_ROOT" log --since="$LAST_WED" --format='%aN' | sort -u >> "$RUN_DIR/authors.tsv"
```

With a team list, the authors are the team; skip the loop. When you show the author list, say that `git log` only contributed names, never the window.

**Metrics:** if `metrics_command` is set, run it from the repo root and keep its last line as `METRICS_TEXT`; empty or failing output means no metrics line. Agents do not run it.

```bash
METRICS_TEXT=$(cd "$REPO_ROOT" && eval "$METRICS_COMMAND" 2>/dev/null | tail -1)
```

## Step 3: Gather, analyze, review

Read [shared/data-handoff.md](../../shared/data-handoff.md) once: agents write `<dataSource:*>`-wrapped files into `RUN_DIR` and return only paths.

**Fleet and cost.** Scale to the week: one git/PR gather agent, one issue agent unless the tracker is `none`, one analysis agent per author who shipped, two critics, and at most one revise and one compile agent. A quiet two-author week is about seven agents. The per-author analysis agents dominate cost and only group and paraphrase, so they run on `sonnet` by default (`analyzeModel` in the workflow args); pass the session model only when the user asks for a deeper read. Each analysis returns at most 16 one-line bullets, which bounds what the compile step pays for.

### Fast path: dynamic workflow

When the `Workflow` tool is available, read [formatting.md](references/formatting.md) for `formatGuide`, say the expected wall-clock (about 1 minute per author plus 3), and launch:

```
Workflow({ scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/weekly/weekly.js",
  args: { runDir, frozen: {lastWed, today}, env: {repoRoot, ghHost},
          repos: [...], team: [...], owner, authors: [{name, login, initials}],
          issueTracker, metricsText, additionalContext, formatGuide, analyzeModel: "sonnet" } })
```

If `${CLAUDE_PLUGIN_ROOT}` does not expand inside `scriptPath`, resolve it with `echo` first. Check elapsed time against the estimate; at 2× with agents still running, read the workflow journal rather than waiting longer.

### Prose path

Without the `Workflow` tool, run the same protocols with the Agent tool. Record `START=$(date +%s)` and put `elapsed Ns / budget Ns` (60s per author plus 180s) in each prompt; the budget is advisory. Spawn the gather agents in one message; cap the analysis fleet at six concurrent.

| Step | Protocol | Writes / returns |
|------|----------|------------------|
| Git and PRs, bucketed per author | [gather-git-prs.md](../../workflows/weekly/prompts/gather-git-prs.md) | `$RUN_DIR/author-<II>.md`, `$RUN_DIR/index.md` |
| Issues (unless `none`) | [gather-issues.md](../../workflows/weekly/prompts/gather-issues.md) | `$RUN_DIR/issues.md` |
| Per-author analysis | [analyze-author.md](../../workflows/weekly/prompts/analyze-author.md) | `{initials, bullets}` |
| Completeness and relevance critics, once | [critic-completeness.md](../../workflows/weekly/prompts/critic-completeness.md), [critic-relevance.md](../../workflows/weekly/prompts/critic-relevance.md) | `{ok, problems}` |
| One revise, only if a critic flagged problems | [revise-sections.md](../../workflows/weekly/prompts/revise-sections.md) | `{sections}` |
| Compile | [compile-status.md](../../workflows/weekly/prompts/compile-status.md) | Markdown status |

One round of critics and revise is enough; do not loop.

## Step 4: Humanize and deliver

Run the `humanizer` skill on the status text when it is installed. Show it in chat and copy it with the first clipboard tool that exists; if none does, the chat copy is the delivery. Write it to a file only when the user names a path.

```bash
clip() { if command -v pbcopy >/dev/null; then pbcopy; elif command -v wl-copy >/dev/null; then wl-copy; elif command -v xclip >/dev/null; then xclip -selection clipboard; else cat >/dev/null; fi; }
clip <<'STATUS'
<status text>
STATUS
```

## Exit checklist

Keep this list current. A text-only turn with an item still open is a progress report, not the end: continue, or name the blocker.

- [ ] Status shown in chat and copied (or written only to the path the user named)
- [ ] Every agent or workflow this run started has returned; stop any still running with `TaskStop`
- [ ] `rm -rf "$RUN_DIR"` — the run directory from Step 1, and nothing else
- [ ] No scratch, draft, or JSON files left in the repo or working directory; the config file is untouched unless the user asked

## Prerequisites

`gh` authenticated for the host (`gh auth status`). If a command is blocked by permissions or a sandbox, ask the user to allow it rather than changing settings yourself.
