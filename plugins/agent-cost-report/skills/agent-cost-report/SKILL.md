---
name: agent-cost-report
description: Agent cost and token spend report for Claude Code sessions from local transcripts. Use for why sessions are expensive, Claude Code session cost, cache rewrites after idle gaps, subagent spend share, top tool errors or hook denials. Not for API pricing or usage-field questions.
effort: low
---

$ARGUMENTS

# Agent cost report

Answers "where did the tokens go" for one project, from the transcripts Claude Code
writes on this machine. Use it before tuning skills, hooks, or CLAUDE.md for cost, and
again afterwards to check whether the change moved the numbers.

Run the script and read only its output. Do not open, `cat`, or `head` the raw `.jsonl`
transcripts: they reach tens of MB each, and the script already streams and aggregates
them. The script is read-only and creates no files, so there is nothing to clean up.

## Run

```bash
S="${CLAUDE_PLUGIN_ROOT}/skills/agent-cost-report/scripts/cost_report.py"
python3 "$S" --list --top 10                                   # which projects exist
python3 "$S" --project="$PWD" --since 2026-10-01 --until 2026-10-03
```

- Transcripts live under `$CLAUDE_CONFIG_DIR/projects`, else `~/.claude/projects`, on
  macOS and Linux alike. `--root` overrides this.
- `--project=` takes a repo path, the encoded dir name (`-home-me-src-foo`), or the full
  path to that dir. Default: the current directory. Use the `=` form, because the
  encoded name starts with `-`. If it is not found, run `--list` and pick from it.
- `--since` / `--until`: inclusive local dates. Default is all history, which is slow
  on big projects, so pass a range.
- `--rates in=5,cache_write=6.25,cache_write_1h=10,cache_read=0.5,out=25`: USD per
  million tokens. Defaults are Opus list prices. If the sessions mostly ran another
  model, pass its list prices (see the `claude-api` skill or the public pricing page)
  and say which rates you used.
- `--top N` rows per table (default 10). `--json` for machine output.

The text report is about 40 lines. Quote its tables; do not re-derive them.

## Reading each section and the lever it points to

**Total and main vs subagent.** Cost is deduplicated per API message. A subagent share
above about half means fan-out dominates spend.
Lever: fewer agents, a fleet sized to the input, shorter agent reports, a cheaper
`model:` for wide fan-out, and one agent reading many files instead of many agents
reading one each.

**Cache rewrites after idle gap.** Every call that comes more than 300 s after the
previous call in the same transcript pays to rewrite the prompt cache. The cost is
charged to what came just before the gap:

| Cause | Meaning | Lever |
|---|---|---|
| sleep poll | a Bash `sleep` of 100 s or more | Stop sleep-polling. Use `run_in_background` and wait for the notification, or poll under 5 minutes |
| test run | pytest, `go test`, `cargo test`, `npm test`, `make test*`, and similar | Run long suites in the background; narrow to the affected tests |
| git commit | a slow `git commit`, usually long pre-commit hooks | Speed up or narrow the hooks, or run the commit in the background |
| agent wait | Agent/Task/SendMessage, a background-task notification, or a message from another session | Several short agents over one long one; do not block on a slow agent |
| user message | the human replied after the gap | Mostly unavoidable; a 1-hour cache TTL helps if this bucket is large |
| other | any other tool before the gap | Look at the top sessions to find it |

**Tool errors.** First line of each failing tool result, with digits shown as `N` and
hex runs as `H`. Each repeated error is a wasted round trip at full context.
Lever: fix the cause, for example a missing permission rule, a broken tool, or a
CLAUDE.md rule the model keeps breaking. Do not add retries. Errors that come from the
environment (network, sandbox, proxy) are infrastructure faults; name them as such.

**Hook denials.** PreToolUse hooks that blocked a call. A high count means the model
does not know the rule before it acts.
Lever: put the rule in CLAUDE.md or in the skill that issues the command, so the call is
right the first time.

**Top sessions.** The session id is the transcript file name; `first` is the first call
in the date range. To dig in, rerun with a narrower `--since`/`--until`, or use
`--json` and filter it with `jq` rather than reading the transcript.

## Report

Lead with the total and the one or two biggest levers, each with its dollar figure from
the tables. Keep it under 15 lines unless the user asks for more.

## Limits

- Prices are list prices, not what any account is billed.
- A gap is measured per transcript file, so a parent waiting on its subagents shows as
  `agent wait` in the parent's file.
- Only this machine's transcripts are read; sessions from other machines or from
  claude.ai do not appear.
