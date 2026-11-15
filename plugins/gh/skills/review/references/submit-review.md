# Submitting the review

Phases 5 and 6 of [`review`](../SKILL.md), plus the failure history that shaped the helper scripts. Nothing here runs in pre-PR/local mode — there is no PR to post to.

## Phase 5: Suggested-diff quality gate

Before submitting, check every surviving finding that has a SUGGESTED_DIFF. Read `$REVIEW_DIR/conventions.md` and check each suggestion against the project's actual conventions — only the ones whose `CLAUDE.md` governs that file's directory or an ancestor of it.

**First, does the suggestion belong at all?** Drop the SUGGESTED_DIFF (keeping the finding as text) when:

1. **It doesn't fully fix the issue.** A one-click suggestion that leaves the bug half-fixed is worse than prose — the author commits it, the PR goes green, the issue survives. If any follow-up edit elsewhere is needed, it's text.
2. **It spans 6+ lines, changes structure, or touches multiple locations.** Describe those instead; GitHub's suggestion UI is for small self-contained edits.

### Validate every anchor against the real file

A `suggestion` block **replaces exactly the lines `startLine`..`line`**, so a replacement whose content doesn't line up with that range corrupts the file the moment the author clicks Apply. Agents get this wrong often: on one measured multi-PR sweep **6 of 10 suggestions had broken anchors**, several of them destructive. Read the actual lines before submitting:

```bash
sed -n "${START},${END}p" "$REVIEW_REPO/$FINDING_PATH"
```

Compare that against the SUGGESTED_DIFF and check all three:

1. **Does the replacement start at `startLine`?** The common failure is a block whose first line is several lines below the anchor — e.g. anchored at 463 while the content begins at what is line 468. Applying it silently deletes 463–467. Fix by moving the anchor to where the content actually begins, or drop the suggestion.
2. **Does it re-include lines outside the range?** A 3-line replacement anchored to a single line duplicates the two neighbours it repeats. Either widen the anchor to cover every line the replacement restates, or drop it.
3. **Does the range cover everything the fix must replace?** A suggestion that merges two table rows, or deletes one of two duplicated props, must be anchored across *all* of them. Anchored to one, it leaves the other behind and half-applies. Widen the anchor, or drop to text.

Prefer repairing the anchor over dropping a correct fix — most of these are off-by-a-few-lines, and the replacement text itself is usually right. Drop the suggestion only when the fix genuinely spans more than a contiguous range.

**Then check each surviving SUGGESTED_DIFF for:**

1. **String formatting style** — Does the project use f-strings, `%` formatting, or `.format()`? Match it. Read nearby code in the same file if unsure.
2. **Magic numbers** — No bare numeric literals. Use named constants, reference existing constants, or use the project's existing pattern for defaults.
3. **Logging style** — Match the project's logger usage: `logger.exception()` vs `logger.error()`, string formatting in log calls, what gets logged.
4. **Naming conventions** — Variable names, function names, class names should match the surrounding code's style.
5. **Import patterns** — If the suggestion requires new imports, match the project's import ordering and style.
6. **Error handling patterns** — Match how the surrounding code handles errors: exception types, fallback values, logging.
7. **Indentation and formatting** — Must match the file exactly. GitHub applies suggestions literally.

**For each suggestion that violates a convention:** rewrite it to match. If the correct convention is ambiguous, drop the SUGGESTED_DIFF and keep the finding as text-only advice.

## Phase 6: Submit the PR review

After Phase 4 presents the findings (all survivors, or the ones kept under `--pick`), submit one GitHub PR review with inline comments for those findings. **Use the helper scripts** — hand-rolling the JSON in shell breaks the moment a finding body contains backticks, code fences, or quotes.

### Step 1: Re-fetch HEAD and rebuild the diff-anchor map

The PR HEAD often moves while the agents run (rebases, force-pushes, follow-up commits). Submitting against a stale `commit_id` or stale line numbers fails with a 422. Always rebuild right before submitting:

```bash
# The PR can also merge or close while the agents run — a long review easily
# outlasts a merge. Re-check state here, not just in Phase 0, or the review
# lands on a closed PR where nobody will read it.
STATE=$(gh pr view $PR_NUM --json state -q '.state')
[ "$STATE" = "OPEN" ] || { echo "PR $PR_NUM is $STATE — skipping submission"; exit 0; }

python3 ${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/diff_anchors.py \
  $OWNER $REPO $PR_NUM > $REVIEW_DIR/diff-anchors.json
```

This refreshes both the `commit_id` and the per-file commentable-line sets to match the current PR HEAD.

### Step 2: Write the surviving findings to a structured file

`$REVIEW_DIR/findings.json` schema (the same schema the workflow returns):

```json
{
  "findings": [
    {
      "path": "src/example.py",
      "line": 45,
      "startLine": 42,
      "severity": "High",
      "title": "Short title",
      "detail": "Why it matters and what to do.",
      "suggestedDiff": "replacement code\nfor the suggestion block"
    }
  ]
}
```

`startLine` is optional (single-line comment if omitted). `suggestedDiff` is optional and renders as a `suggestion` block in the inline comment.

### Step 3: Build the payload

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/build_payload.py \
  --findings $REVIEW_DIR/findings.json \
  --anchors $REVIEW_DIR/diff-anchors.json \
  --repo "$OWNER/$REPO" \
  --host "$HOST" \
  --summary "Reviewed with parallel agents (logic, security, performance, error handling, architecture, tests, conventions)." \
  --output $REVIEW_DIR/payload.json
```

What this does:

- Reads `commit_id` straight from the anchor map (always current).
- For each finding, checks whether `line` (and `startLine` if set) is in the anchor map for that file.
  - **In-diff findings** become inline comments with the standard `**[SEVERITY]** TITLE\n\nDETAIL\n\n```suggestion\n…\n```` body.
  - **Out-of-diff findings** (callers that should also be updated, existing tests this change breaks, file-level concerns) get rendered as `### [SEVERITY] TITLE — path:line` sections in the review body, each followed by a GitHub permalink so the reader can still jump to the code.
- Derives `event` from severities (any High/Critical → `REQUEST_CHANGES`, otherwise `COMMENT`) unless `--event` is passed.
- Includes a count line like `**N findings** (1 high, 2 medium)`.

`--repo` is what enables those permalinks; omit it and body findings render as plain `path:line` text. It's validated as `OWNER/REPO` and exits 2 on anything else — a malformed value would otherwise emit links that look right and 404.

**Always pass `--host "$HOST"`** (the value Phase 1 already derived from the PR URL). It defaults to `github.com`, so on GitHub Enterprise every body-routed finding gets a permalink that 404s — and body routing is exactly where out-of-diff findings land, so the links that matter most are the ones that break.

If `findings.json` is empty, the script exits non-zero and prints "skip review submission" — handle that case by not submitting at all (an empty `COMMENT` review is just noise).

### Step 4: Run /humanizer on the review body and inline comments

Read `$REVIEW_DIR/payload.json`, run `/humanizer` over the `body` field and every `comments[].body`, and write back. Goal: no bot-like formatting patterns, no formulaic structure, natural direct prose. Code blocks stay verbatim.

### Step 5: Submit

```bash
gh api repos/$OWNER/$REPO/pulls/$PR_NUM/reviews \
  --input $REVIEW_DIR/payload.json
```

If GitHub returns 422 anyway (rare — usually means the PR HEAD moved between Step 1 and now), re-run Step 1 + Step 3 + Step 5. **Do not** submit "probe" reviews to discover valid lines; the anchor map is the source of truth.

### Step 6: Clean up

Once the review is posted, remove the session directory, clone included:

```bash
rm -rf "$REVIEW_DIR"
```

A full clone is often hundreds of megabytes, and nothing else removes it, so finished reviews pile up in the temp dir on a shared host. Delete `$REVIEW_DIR` by its literal `mktemp` path, never through `$REVIEW_REPO`: in pre-PR mode `$REVIEW_REPO` is the user's own checkout. Keep the directory only when the user wants a follow-up on these findings, and say where it is.

### Review verdict logic

| Condition | Event | Meaning |
|-----------|-------|---------|
| Any **Critical** or **High** findings posted | `REQUEST_CHANGES` | PR needs fixes before merge |
| Only **Medium** or **Low** findings posted | `COMMENT` | Suggestions but not blocking |
| Zero posted findings | (skip submission) | Nothing to say |

`build_payload.py` derives this automatically; pass `--event` only to override.

### Inline comment format (what build_payload.py emits)

````
**[SEVERITY]** TITLE

DETAIL

```suggestion
<replacement code from SUGGESTED_DIFF>
```
````

GitHub renders `suggestion` blocks as a clickable "Apply suggestion" button. The author can accept the fix in one click. Findings without `suggestedDiff` get the same shape minus the suggestion block.

### Rules for suggested changes

- The `suggestion` block replaces the lines the comment is attached to. `start_line` (start) and `line` (end) define the range. `build_payload.py` only emits `start_line` when `startLine != line` and both are in-diff.
- Only include a suggestion when the fix is unambiguous and correct. Wrong suggestions waste more time than no suggestion.
- Don't suggest changes that require modifications outside the commented line range — use plain text instead.
- Preserve the original indentation exactly. GitHub applies the suggestion literally.

### Notes

- Submit **one review** with all comments — not individual comments. A single review carries the verdict.
- Only use `APPROVE` if zero findings survived and the code looks good.
- If a finding spans multiple files, pick the primary file for the inline anchor and mention the others in the detail.
- **Consolidate co-anchored findings into one comment.** When several distinct findings target the same file/class and their fixes collapse into a single block (one parametrize for several missing test cases, one extracted helper covering several inlined sites), post them as **one** inline comment with one suggestion block — not N comments at the same anchor. The merge phase dedups *identical* findings; this rule covers distinct findings whose *fixes* share an anchor.

## Why these helpers exist

The friction the helpers remove (every issue here was hit in production):

| Failure | Root cause | Fix |
|---|---|---|
| 422 `"Pull request review thread line must be part of the diff"` | Local clone HEAD diverged from live PR HEAD (rebase / amend / follow-up commit during the agent run). Line numbers from local diff don't match GitHub's view. | `diff_anchors.py` reads from `gh api .../pulls/$PR/files` (always live), and Phase 6 re-fetches right before submitting. |
| 422 `"path is invalid"` for findings about callers / breaking tests outside the diff | The skill said "include in the review body" but didn't define how. Launchers tried to attach inline comments to lines GitHub doesn't expose. | `build_payload.py` auto-routes any finding whose line isn't in the anchor map into a `### [SEVERITY] TITLE — path:line` body section. |
| 400 `"Problems parsing JSON"` from heredoc payloads | Code samples in finding bodies contain backticks, dollar signs, escaped quotes, real quotes. Shell heredocs and `gh api -f body=...` mangle them. | `build_payload.py` builds the payload via `json.dump`. No escaping bugs. |
| `fatal: Remote branch <ref> not found in upstream origin` on a fork PR | Phase 1 cloned `$OWNER/$REPO` unconditionally, but a cross-repository PR's head branch only exists in the contributor's fork. | Phase 1 clones `$HEAD_OWNER/$REPO` and fetches the base from an `upstream` remote. |
| An applied suggestion deletes or duplicates lines | A SUGGESTED_DIFF whose content doesn't align with `startLine`..`line` — content starting below the anchor, or restating neighbours outside it. Measured at 6 of 10 suggestions on one sweep. | The anchor validation in Phase 5 above reads the real lines with `sed -n` and repairs or drops the anchor before submitting. |
| A review lands on a merged PR, or the local diff comes back empty | The PR merged between the Phase 0 state check and the submit; a long review outlives a merge. Once merged, the head is an ancestor of the base, so `git diff base...HEAD` is empty. | Re-check `state` in Step 1 above, and treat an empty diff as a signal to stop rather than a reason to review nothing. |
| Probe submissions ("test inline" reviews) cluttering PRs | Launchers tried to discover valid lines empirically by submitting throwaway reviews. | `diff_anchors.py` is the answer up front. Probe reviews are explicitly forbidden in Step 5. |
