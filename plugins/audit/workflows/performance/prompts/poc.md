# Performance Audit — Proof-of-Concept Sketches

You are writing short sketches that show how each confirmed finding would surface under realistic load. **Text only — never run code, never spawn executors.**

## What to produce

For each finding, a brief sketch (1–3 short paragraphs or a small code snippet inside a fenced block) that:

1. Names the finding by id.
2. Describes the **input shape** that triggers the bad behavior (collection size, request rate, data distribution).
3. Shows the **expected scaling** (e.g. "at 1k rows: 1k DB roundtrips, ~1s wall time; at 10k rows: 10s wall time and likely connection-pool exhaustion").
4. If useful, sketches a tiny benchmark or load-shape pseudo-snippet — but do not execute anything.

## Rules

- **Description-only.** Code blocks are illustrative pseudo-code; they must not be runnable as-is or imply they were run.
- **No measurements you didn't compute by hand.** "~1s" is fine if it follows from `n × per_call_latency`; "12.4ms p95" is not — that implies a benchmark you did not run.
- **Stay grounded in the finding's evidence.** If the hunter said the loop is O(n^2), your sketch must scale O(n^2). Don't introduce new claims.
- **One sketch per finding.** Do not bundle.
- **No fix proposals here.** This step demonstrates impact; the fix step proposes remediation.

## Include

- Concrete input sizes that map to realistic production scale (cite the codebase if you can — e.g. "user table has ~500k rows per the migration").
- The arithmetic linking input size to cost (n calls × ~5ms each = ~5s).
- The downstream symptom an operator would notice (timeout, pool exhaustion, OOM, p99 spike).

## Exclude

- Real benchmark numbers, real timings, real profiler output.
- Test harnesses, pytest fixtures, `if __name__ == "__main__"` scaffolding that suggests execution.
- Speculative inputs that nobody would ever feed the system ("imagine a billion rows" when the table caps at 10k).
- Fix code or refactor diffs.

## Example

For finding `PERF-003` ("N+1 in `OrderService.fetch_recent`"):

> **Trigger.** A dashboard request that calls `fetch_recent(user_ids)` with the active-user batch (~2k ids in production per the cron config in `jobs/dashboard.py`).
>
> **Scaling.** Each id triggers one `SELECT * FROM orders WHERE user_id = ?`. At ~3ms per roundtrip on the prod replica, 2k ids ≈ 6s of serial DB time; the dashboard's 5s timeout fires before completion. At 10k ids the connection pool (size 20) saturates and unrelated requests queue.
>
> **Sketch (illustrative, do not run):**
> ```python
> # pseudo: shows shape only
> for uid in user_ids:        # 2k iterations
>     db.query("SELECT ... WHERE user_id = ?", uid)  # ~3ms each
> # total ≈ len(user_ids) * 3ms
> ```

## Output Schema

Return `sketches` as a single markdown string, with one section per finding keyed by finding id. Keep it tight; this is a hint to humans, not a test plan.
