# Running a multi-PR sweep

Companion to [`monitor-pr`](../SKILL.md#multi-pr-sweep). Args are in
[workflow-args.md](workflow-args.md).

## Before launching

1. **One sweep at a time.** If a `monitor-pr-sweep` workflow is already running in this session,
   do not start another: concurrent sweeps fight over worktrees and force-pushes. On a `/loop`,
   log "previous sweep still running, skipping" and return.
2. **Logged in**: `gh auth status 2>&1 | head -5` shows the target host. Run from inside the repo;
   the fix worktrees branch off the current checkout's `.git`.
3. **Triage the fleet**, one cheap query per PR, so its shape is known while the args can change:

```bash
for n in <PR numbers>; do
  gh api graphql -f query='query($o:String!,$r:String!,$p:Int!){repository(owner:$o,name:$r){
    pullRequest(number:$p){mergeable reviewThreads(first:100){nodes{isResolved}}}}}' \
    -f o=OWNER -f r=REPO -F p=$n \
    --jq "\"$n \" + .data.repository.pullRequest.mergeable + \" unresolved=\" +
          ([.data.repository.pullRequest.reviewThreads.nodes[]|select(.isResolved==false)]|length|tostring)"
  gh api "repos/OWNER/REPO/pulls/$n/reviews?per_page=100" \
    --jq '[.[]|select(.state=="CHANGES_REQUESTED")|.user.login]|unique|join(",")'
done
```

   - **Give outliers their own run.** One PR with more open threads than the rest combined holds
     up the whole wave's result.
   - **Classify every `CHANGES_REQUESTED` author** as human or bot now; it decides what is
     dismissible later.
   - **Report the size** to the user (PR count, open threads, conflicts) before the spend.
4. **Wide, vague selector** ("fix every PR"): run with `dryRun: true` first to size it, report the count, then launch the real sweep without waiting.
5. **Prune stale worktrees** so the sweep's worktrees do not compete with dead ones for disk and
   the index lock: `git worktree prune`, then `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/worktree.py" prune`
   (dry run) and `--apply` when the list is what you expect.

## `hardConstraintsExtra`

Fix agents obey the target repo's house rules only if you pass them. Read the repo's `CLAUDE.md`,
`CONTRIBUTING.md`, and any agent instructions on testing or commits, and lift what a fix agent
would otherwise break:

- how to run tests, and which suite matches a change; targeted tests, never the full suite, when
  many agents share the machine (a run "waiting for a slot" is queued, not stuck);
- commit format and sign-off (`-s`);
- lint and typing rules the pre-commit hook enforces;
- issue-link format, docs-update requirements, required test markers.

The plugin's PreToolUse hook clone-seeds each fix worktree on first use, so do not tell agents to
`npm ci` a `node_modules/` that is already there.

## While it runs

The expensive failure is a run that looks alive and is not. Say the expected wall-clock before
launching (`~2 min per PR + ~5 min`). The harness notifies you when the workflow ends; do not
poll it. To catch a wedged agent, set one wake at twice the estimate (a background `sleep`, which
you stop if the sweep ends first). Any timed wait is at most 270 s or at least 20 min: waits in
between expire the prompt cache for nothing.

```bash
jq -c 'select(.label | startswith("fix:#")) | {label, status}' <transcriptDir>/journal.jsonl | tail -30
```

- **A `fix:#<N>` agent with no new activity for 20 minutes gets `TaskStop`**, then that PR is
  re-run alone with a narrower brief. Stopping one agent does not stop the others.
- **Read the Discover output early.** `!! #N discovery passed K feedback items but found M
  unresolved threads` means feedback was wrongly filtered: stop the run and fix the args. A wave
  against empty feedback reports success having changed nothing.
- If you stop a sweep partway, report which PRs were fixed, which were mid-flight, and which never
  started, then run the cleanup for the worktrees that exist.

## Recurring sweeps

On a `/loop`, use an interval of at least 20 minutes, or `ceil(PRs × 2 min + 5 min)`. Shorter
intervals only hit the one-sweep-at-a-time guard. Every round carries the same `excludePrs`.
Each round cleans up its own worktrees before the next starts.
