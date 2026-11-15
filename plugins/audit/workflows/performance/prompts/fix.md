# Performance Audit — Apply Fixes

Apply fixes for confirmed performance issues. You receive a JSON list of confirmed findings; edit the code to resolve each bottleneck while preserving behavior.

## Rules

- **Preserve behavior.** A fix that changes observable semantics is not a fix — skip it.
- **Match the issue class to a real remedy:**
  - N+1 queries → batch (e.g. `WHERE id IN (...)`, `prefetch_related`, dataloader).
  - Unbatched IO → use concurrency primitives the project already uses (`Promise.all`, `asyncio.gather`, etc.).
  - Blocking in async → move CPU-heavy or sync IO off the event loop / main thread.
  - Missing pagination → add a page/limit parameter and stream/iterate.
  - Quadratic algorithms → switch to a hash lookup, sort once, or pre-index.
  - Resource leaks → return handles to pools / use context managers / close in `finally`.
  - Eager loading → load only the fields/IDs you actually use.
  - Cache misses → memoize at the right layer; don't introduce a new cache without invalidation.
- **Keep edits minimal.** Touch only what the fix requires.
- **Skip unsafe or unclear fixes.** If you can't see a clean, behavior-preserving change, omit the finding from `applied`/`fixed`.

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
