# Workflow Operations Runbook

For an agent that just launched a Workflow tool call and now needs to inspect, debug, resume, or kill it. Every section is a recipe — copy the snippet, set `WF`, go.

## Locate a run

The Workflow launch result returns `runId` (e.g. `wf_abc123`) and a transcript dir path. Stash both.

```bash
# Lost the path? Newest run wins.
ls -td ~/.claude/projects/*/*/subagents/workflows/wf_*/ | head -5

# Pin it for the rest of this session.
WF=~/.claude/projects/<encoded-cwd>/<sessionId>/subagents/workflows/wf_<runId>
ls "$WF"   # journal.jsonl and agent-<id>.jsonl files
```

## Count agents in flight

`result` events can repeat (cache replays, retries) — always `sort -u` on `agentId` first.

```bash
started=$(jq -r 'select(.type=="started") | .agentId' "$WF/journal.jsonl" | sort -u | wc -l)
done=$(jq   -r 'select(.type=="result")  | .agentId' "$WF/journal.jsonl" | sort -u | wc -l)
echo "started=$started done=$done in_flight=$((started-done))"
```

## Identify what each agent is doing

The journal carries no `label` or `phase` field — just `agentId` + content-addressed `key`. To recover labels, peek into the per-agent transcript.

```bash
# First ~200 chars of the agent's user prompt — usually contains the workflow-assigned label.
for f in "$WF"/agent-*.jsonl; do
  id=$(basename "$f" .jsonl)
  prompt=$(head -2 "$f" | jq -r '.message.content[0].text // empty' 2>/dev/null | head -c 200)
  echo "== $id =="; echo "$prompt"; echo
done

# Most-recently-active agents (likely still running):
ls -lt "$WF"/agent-*.jsonl | head
```

GAP: there is no journal-level label/phase. The workaround above is the only way without modifying the workflow script to write its own progress file.

## Tail an agent without nuking your context

`agent-<id>.jsonl` can be hundreds of KB of full conversation — never `cat` it.

```bash
# Cheap heartbeat — just byte count and line count.
wc -lc "$WF/agent-a3.jsonl"

# Recent tool calls / text snippets only.
tail -20 "$WF/agent-a3.jsonl" \
  | jq -r '.message.content[]? | .name // .text? // empty' \
  | head -20

# What tools has this agent been using overall (frequency)?
jq -r '.message.content[]? | .name // empty' "$WF/agent-a3.jsonl" | sort | uniq -c | sort -rn
```

## See structured results so far (cheapest visibility)

Every agent that finished returns a schema-shaped object in `journal.jsonl`. This is the highest signal-per-byte view of the run.

```bash
jq -c 'select(.type=="result") | {agentId, result}' "$WF/journal.jsonl" | tail -10

# Just the result payloads (drop agent IDs):
jq    'select(.type=="result") | .result' "$WF/journal.jsonl" | tail -50
```

## Wait for completion vs non-blocking peek

The Workflow tool returns immediately with a task id. Completion arrives later as a `<task-notification>`; the `.output` file referenced there holds the final result JSON.

```bash
# Non-blocking peek — never needs a tool call, just filesystem.
jq -c 'select(.type=="result") | .agentId' "$WF/journal.jsonl" | sort -u | wc -l

# Blocking: wait for the notification — don't poll, don't sleep loops.
```

## Resume after editing the script

Re-launch with `resumeFromRunId` to keep already-finished agents cached.

```javascript
Workflow({ scriptPath: "<path>", resumeFromRunId: "wf_<id>" })
```

Cache key is content-addressed (`v2:<hash>` of prompt+opts). Same script + same args + unchanged agent prompts → 100% cache hit. Touch an agent's prompt text and only that agent re-runs. Useful when one phase blew up and you want to fix it without redoing the previous fan-out.

## Kill a stuck run

```javascript
TaskStop({ task_id: "wf_<id>" })   // also accepts the parent w_<id> if that's what you have
```

`TaskStop` ends the run and its agents. It does not undo their side effects: run the cleanup below.

## Clean up after a run

Do this after every run, whether it finished, failed, or was stopped. Remove only what this run made. Record the baseline before the launch so that you can tell what is new:

```bash
git -C <repo> status --porcelain=v1 -uall > "$RUN_DIR/status.before"   # RUN_DIR from mktemp -d
git -C <repo> worktree list --porcelain | grep '^worktree' > "$RUN_DIR/worktrees.before"
git -C <repo> branch --format='%(refname:short)' > "$RUN_DIR/branches.before"
git -C <repo> stash list | wc -l > "$RUN_DIR/stash.before"
git -C <repo> rev-parse HEAD > "$RUN_DIR/head.before"
```

After the run, compare against the baseline:

```bash
# Worktrees and branches this run added: remove them, then prune stale entries.
comm -13 "$RUN_DIR/worktrees.before" <(git -C <repo> worktree list --porcelain | grep '^worktree')
git -C <repo> worktree remove <path> && git -C <repo> worktree prune
comm -13 "$RUN_DIR/branches.before" <(git -C <repo> branch --format='%(refname:short)')
git -C <repo> branch -D <temp-branch>          # only branches this run created

# Untracked files that are new and are not intended edits (scratch, logs, PoC files):
comm -13 <(sort "$RUN_DIR/status.before") <(git -C <repo> status --porcelain=v1 -uall | sort)

# A commit or stash the run should not have made:
[ "$(git -C <repo> rev-parse HEAD)" = "$(cat "$RUN_DIR/head.before")" ] || echo "HEAD moved"
[ "$(git -C <repo> stash list | wc -l)" = "$(cat "$RUN_DIR/stash.before")" ] || echo "new stash"

rm -rf "$RUN_DIR"
```

If HEAD moved, `git reset --soft <head.before>` keeps the edits and drops only the commit. Do not drop a new stash: tell the user that it exists, because it holds working-tree content.

Each Bash call runs in a new shell, so a `trap 'rm -rf "$RUN_DIR"' EXIT` protects only a single-call script. A run that spans calls needs the explicit `rm -rf` above.

## Per-workflow specifics

Every workflow `.js` (`shared/workflows/` here, or a plugin's `workflows/<name>/`) opens with a header comment. The header describes the phases, the fan-out shape, the scope knobs, which phases write to disk, and the common failure modes. Read it before you guess:

```bash
head -80 <scriptPath>   # the script path the Workflow launch result returned for this run
```
