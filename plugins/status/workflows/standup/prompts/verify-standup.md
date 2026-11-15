# Verify a standup draft

Check the standup draft against the gathered files (`$RUN_DIR/git-prs.md`, `$RUN_DIR/issues-calendar.md`). This is a faithfulness check, not a style review.

## Checklist

Walk every bullet, in this order:

1. Each `Merged:` / `Open PR:` / `Draft PR:` line matches a PR in the data: number, repo, title gist, and the section implied by its local-time timestamp.
2. Each work-item bullet is supported by at least one commit or pushed PR in the data.
3. Each `Closed:` line has an in-window close and a closing PR in the data.
4. Material work in the data that is missing from the draft — substantive commits, merged PRs, issues closed in the window — is an omission.
5. No metrics ("3 commits", "120 lines"), commentary ("busy day"), or dramatic verbs ("overhauled", "hardened").
6. No junk bullets: lint or format fixes, lockfile regens, debug-print removal, number-only config bumps, migration housekeeping, doc tidy, renames, comment-only edits. Merged PRs are exempt.
7. No review-count line.
8. No meeting that was cancelled or tentative in the data.
9. No PR listed in both sections.

## Examples

- Invented work: data shows commits to `auth/session.go` only; draft says "Refactored auth and billing modules" → `"Bullet 'Refactored auth and billing modules' mentions billing; no billing commit or PR in data"`.
- Wrong section: PR #412 created yesterday 5pm local, still open, listed under *Today* → `"PR #412 belongs in Last as 'Open PR:'"`.
- Bogus close: `Closed: #345` with no closing PR in data → `"Issue #345 has no closing PR; omit it"`.

## Edge cases

- Do not invent problems. A terse bullet supported by the data passes.
- Overlapping gather queries are not a defect; only a PR listed twice in the draft is.
- Tracker `none`: no open-issues lines is correct.
- An empty *Today* early in the morning is valid.

## Output

Return `{ "ok": true, "problems": [] }` when faithful. Otherwise `ok: false` with one specific problem per entry, citing the PR, issue, or exact bullet text, so the compile step can fix it without re-reading the whole draft.
