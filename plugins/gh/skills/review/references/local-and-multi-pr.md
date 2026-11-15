# Pre-PR (local) setup and multi-PR sweeps

Companion to [`review`](../SKILL.md). The review pipeline itself is identical in all three modes — only setup and output differ.

## Pre-PR mode: build the local changeset

Use the current repo directly as the review repo — no clone needed. The live working tree is a *better* source than a clone because it reflects uncommitted edits, exactly what the verify pass should check against.

```bash
REVIEW_DIR=$(mktemp -d "${TMPDIR:-/tmp}/gh-review.XXXXXX"); echo "$REVIEW_DIR"
REVIEW_REPO="$(git rev-parse --show-toplevel)"
cd "$REVIEW_REPO"

# Base: the branch the user named, else the repo's default branch, else origin/HEAD
BASE=${BASE:-$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null)}
BASE=${BASE:-$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')}
BASE=${BASE:-main}
# In a fork checkout the upstream remote holds the real base; the fork's copy is often stale
UP=$(git remote | grep -qx upstream && echo upstream || echo origin)
MERGE_BASE=$(git merge-base HEAD "$UP/$BASE" 2>/dev/null || git merge-base HEAD "$BASE" 2>/dev/null || echo "$BASE")

# Committed + uncommitted (tracked) changes since the base
git diff "$MERGE_BASE" > $REVIEW_DIR/diff.txt

# Untracked/new files: git diff omits them, so append them as add-file hunks
git ls-files --others --exclude-standard -z | while IFS= read -r -d '' f; do
  git diff --no-index /dev/null "$f" 2>/dev/null
done >> $REVIEW_DIR/diff.txt

# One diff per changed path plus a manifest; prints the changedLines to pass on
python3 ${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/split_diff.py \
  $REVIEW_DIR/diff.txt $REVIEW_DIR/files

# Commit history since the base (empty is fine — changes may be uncommitted)
git log "$MERGE_BASE"..HEAD --oneline > $REVIEW_DIR/commits.txt

# Project conventions — repo-relative headers, so agents can scope each rule
find "$REVIEW_REPO" -name "CLAUDE.md" -not -path "*node_modules*" -not -path "*/.git/*" \
  -not -path "*/.worktrees/*" -not -path "*/.claude/worktrees/*" \
  | while read f; do echo "=== ${f#$REVIEW_REPO/} ==="; cat "$f"; echo; done \
  > $REVIEW_DIR/conventions.md
```

**No existing comments** to fetch and **no diff-anchor map** to build — skip Phase 1.5 entirely and omit `existingCommentsPath`.

**No PR intent either** — pass `prTitle: ""` and `prBody: ""`. `commits.txt` carries what intent exists here. If the user described what they're doing in the conversation, pass that as `prBody`; it's the same signal a PR description would give, and it's the cheapest way to stop agents flagging deliberate work-in-progress.

If `diff.txt` is empty, there's nothing to review — tell the user the working tree is clean against `$BASE` and stop.

### Run it

```
Workflow({ scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/review/review.js",
  args: { diffPath: "$REVIEW_DIR/diff.txt", filesDir: "$REVIEW_DIR/files", changedLines,
          conventionsPath: "$REVIEW_DIR/conventions.md",
          commits, prTitle: "", prBody: "", repoPath: "$REVIEW_REPO" } })
```

Triage still runs here — a local changeset that's pure lockfile churn is no more worth a full fan-out than a PR would be. Pass `force: true` to override.

If the `Workflow` tool is unavailable, run Phases 2–3 of the prose pipeline (the dimension agents + verify + dedup) against `$REVIEW_DIR/diff.txt` and `$REVIEW_REPO` exactly as written — those phases are PR-agnostic.

### Present findings (and optionally fix)

Present the surviving findings grouped by tier, then severity, then file — the same text format as Phase 4:

```
## Pre-PR Review Findings (N total)

### Bug
- **[High] [path:line]** Title — detail *(dimension)*

### Quality / ### Nit
- ...
```

Then:

- **Default (no `--fix`):** stop here. The findings are the deliverable — the user fixes what they want, then opens the PR. Do not edit files.
- **`--fix`:** run the [suggested-diff quality gate](submit-review.md#phase-5-suggested-diff-quality-gate) on the surviving findings (only the picked ones under `--pick`), then apply their `suggestedDiff` fixes to the working tree with `Edit`. Only apply findings whose suggestion is unambiguous; leave the rest as text advice. Re-run tests after applying (see the project's test command) and report what changed.

Never run the [Phase 6 GitHub submission steps](submit-review.md#phase-6-submit-the-pr-review) in this mode — there is no PR, no `commit_id`, and no anchor map. The whole point is to finish *before* the PR exists.

## Multi-PR mode

When invoked with `--prs N,M,...`, a search query, or "review every open autofix PR" / equivalent, run one full pipeline per PR with isolation:

1. **Resolve the PR list once** — e.g., `gh pr list --search "..." --json number,headRefName,isDraft --limit 100`.
2. **Apply Phase 0 per PR.** Drop non-open PRs, drop drafts (unless the user named that PR explicitly), and drop any PR you've already reviewed at its current HEAD SHA. Log each skip with its reason and report the tally at the end — a sweep that silently reviews 3 of 12 PRs looks identical to one that found nothing.
3. **Allocate per-PR working dirs** — `mktemp -d "${TMPDIR:-/tmp}/gh-review-pr$PR_NUM.XXXXXX"` for each PR, and record every path. Don't share clones; the cloned head is PR-specific.
4. **Run Phase 1 + 1.5 in parallel** (one Bash background task per PR for clone/diff/anchors).
5. **Launch Workflows in parallel** — five `Workflow` calls in one message. Each gets its own args object with that PR's diff/conventions/intent/etc. The Workflow tool is non-blocking and returns immediately with a task ID.
6. **As each workflow completes**, write its returned `findings` to that PR's `findings.json`, then run Phase 6 (re-fetch anchors, build payload, submit) for that PR, then remove that PR's directory. **Do not batch the submits across all PRs** — each submit needs a fresh anchor map for *its* PR.
7. **Each PR posts its own review without a gate,** as in single-PR mode. `--pick` does not scale to a sweep; ignore it there and say so.
8. **Clean up at the end**, including when the sweep stops early: stop any workflow or background clone task still running (`TaskStop`), `rm -rf` every per-PR directory you recorded, and remove the lockfile below if you took it.

A sweep multiplies the per-PR agent cost by the PR count, so set `reviewModel` (see the Cost section in SKILL.md) before launching a wide one.

Per-PR errors should not abort the sweep. If one PR's anchor fetch fails or its workflow returns no findings, log and move on.

### Recurring sweeps (cron, `/loop`, "check every N minutes")

A sweep that runs on a schedule needs two things a one-shot sweep doesn't. Both were learned the expensive way.

**Take a single-flight lock.** A review takes 10–25 minutes per PR, so any sweep with a backlog outlives a 30-minute interval. The next tick then re-reviews PRs whose reviews haven't been submitted yet — the HEAD-SHA check can't help, because it only sees *submitted* reviews — and duplicate reviews land on other people's PRs. Hold a lockfile for the whole run, skip the run outright if it's held, and treat a lock past a generous age as stale so a crashed run can't wedge the schedule:

```bash
LOCK="${TMPDIR:-/tmp}/gh-review-sweep-$(gh repo view --json nameWithOwner -q .nameWithOwner | tr / _).lock"
if [ -n "$(find "$LOCK" -mmin -120 2>/dev/null)" ]; then
  echo "sweep already in progress — skipping"; exit 0
fi
echo "started=$(date -u +%FT%TZ) pid=$$" > "$LOCK"   # rm -f "$LOCK" when the sweep ends, however it ends
```

Queued ticks are a separate hazard: if the agent was busy, several identical prompts can arrive at once. Coalesce them into one run rather than sweeping once per tick.

**Record clean results locally.** A review with zero findings submits nothing, so GitHub holds no record of it and the PR reappears on every subsequent sweep — a full fan-out re-derives "nothing wrong" forever. Keep a durable ledger keyed by PR *and* full head SHA, and skip on a hit:

```bash
LEDGER=~/.claude/review-clean-ledger.json   # outside /tmp so it survives reboots
```

Key it on the **full 40-char SHA**, not an abbreviation. Keying the write on `sha[:8]` while the lookup builds the full SHA fails silently — the ledger simply never matches, and the only symptom is the PR coming back.
