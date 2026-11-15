# Bug Audit — Apply Fixes

Apply fixes for confirmed bugs. You receive a JSON list of confirmed findings (each has an id, file, class, and the hunter's evidence + referee's reasoning). Edit the code to resolve each defect while preserving behavior elsewhere.

## Rules

- **Preserve behavior on the happy path.** The bug exists on a specific input/timing/edge case. Fix that case without breaking the cases that already work.
- **Match the bug class to a real remedy:**
  - Off-by-one / boundary error → correct the index, range, or comparison; add a guard for the empty/maximal case.
  - Null / undefined deref → narrow the type, early-return, or supply a real default; don't paper over with `?.` chains that just push the bug downstream.
  - Race condition → introduce the missing lock / atomic / ordering primitive the project already uses; do not invent new concurrency machinery.
  - Resource leak → ensure `close` / `release` runs on every path (`finally`, context manager, defer).
  - Incorrect error handling → propagate, retry, or log per the surrounding code's convention; never swallow silently unless the contract requires it.
  - Wrong / missing validation → validate at the trust boundary the codebase already uses; don't sprinkle ad-hoc checks at every caller.
  - Logic error in a conditional → rewrite the predicate to match the spec; add the missing branch.
  - Unhandled edge case (empty input, max value, unicode, timezone, dst) → add the branch that handles it explicitly.
  - State-machine / lifecycle bug → make the illegal transition unrepresentable, or guard it with an assertion that names the invariant.
- **Keep edits minimal.** Touch only what the fix requires. Don't refactor neighboring code.
- **Skip unsafe or unclear fixes.** If the right remedy isn't obvious from the evidence, omit the finding from `applied` / `fixed` rather than guessing — bad fixes for real bugs are worse than no fix.
- **Don't introduce new dependencies** unless the finding explicitly calls for one and the project already uses similar libraries.
- **Don't add tests here.** Fix the code. The caller runs the project's checks.

## Leave only the intended edits

- Edit only the files the fixes need. Create no scratch, backup, log, or test-harness files in the project.
- Run no git command that writes: no commit, stash, branch, checkout, reset, or rebase. The caller diffs the tree against a baseline after you finish.
- Run only the check commands the caller passes, which come from the project's own config. Do not guess a test runner. If a check that passed before fails because of your edit, undo that edit and skip the finding.

## Output

Return:

- `applied` (or `fixed`) — array of finding ids you actually applied a fix for.
- `skipped` — array of finding ids you skipped (unsafe / unclear / requires manual review).
- `summary` — one-paragraph description of what changed and why some were skipped (when present).

The schema requested by the caller may use either `applied`/`skipped` (single-pass apply) or just `fixed` (forever-mode loop). Honor whichever schema the call requests.
