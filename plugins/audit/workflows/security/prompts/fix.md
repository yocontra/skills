# Apply fixes for confirmed security findings

Apply remediations for the supplied list of confirmed security findings (JSON in PARAMETERS).

## What to do

For each finding, edit the code to remediate while **preserving behavior**:

- Parameterize the query.
- Validate / encode the input.
- Add the trust boundary (e.g. `<dataSource:*>` wrapping for external data fed into prompts).
- Upgrade the dependency to its fixed version with the project's own package manager, so that the manifest and the lock file stay in sync. If the upgrade needs network access you do not have, skip the finding and say why.
- Add the missing auth check.

## Constraints

- Do not write or run exploit code.
- Skip and omit any fix that is unsafe, ambiguous, or that you can't make confidently. Better to leave it for manual review than to introduce a new bug.

## Leave only the intended edits

- Edit only the files the fixes need. Create no scratch, backup, log, or test-harness files in the project.
- Run no git command that writes: no commit, stash, branch, checkout, reset, or rebase. The caller diffs the tree against a baseline after you finish.
- Run only the check commands the caller passes, which come from the project's own config. Do not guess a test runner. If a check that passed before fails because of your edit, undo that edit and skip the finding.

## Output

Return the fields the caller's schema asks for:

- Single-pass fix mode: `applied` (ids you fixed), `skipped` (ids you left for manual review), and `summary` (what changed and why each skipped finding was skipped).
- Forever mode: `fixed` (ids you fixed). Omit anything you skipped.
