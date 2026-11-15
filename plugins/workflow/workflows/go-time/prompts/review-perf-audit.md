# Performance Audit (Single-Pass)

Audit the changed code for real performance bottlenecks at realistic production scale, in a single pass. This is a lightweight check inside the workflow — for full adversarial depth (hunter / skeptic / referee), `/audit:performance` is run separately.

## Scope

Review **only** the files changed in the working tree. Enumerate the changeset with `git status --porcelain` (or use the `CHANGED_FILES` list the orchestrator provides) — this **includes newly created (untracked) files** that `git diff` alone omits. Inspect modified files with `git diff`; **read newly created files directly** (they won't appear in `git diff`).

## What to look for

Focus on bottlenecks that bite at realistic scale, not micro-optimizations.

- **Algorithmic complexity** — accidental O(n²) where O(n) was trivial, nested loops over already-loaded collections, repeated linear scans for a lookup that could be a map.
- **N+1 queries / fan-out** — per-item DB queries inside a loop, per-item RPCs, per-item file reads, missed batching.
- **Blocking I/O on hot paths** — synchronous network/disk in request handlers or render paths, no concurrency where it would obviously help.
- **Allocations in hot loops** — unnecessary copies, per-iteration buffers, string concatenation that could be joined, regex compiled per call.
- **Caching opportunities missed** — values recomputed every call that are deterministic and stable; configuration parsed per request.
- **Backpressure & unbounded work** — unbounded queues, parallelism without limit, retries without timeout, listeners that accumulate without cleanup.
- **Missing indices / inefficient query patterns** — DB queries that obviously can't use an index (`LIKE '%foo'`, full-table scans, missing pagination).

## Standard

Every finding must describe **the realistic scale at which it bites** and the rough cost. "Inefficient" is not a finding. "`getUser(id)` is called once per row inside a loop iterating up to 10k rows; each call hits the DB — 10k round-trips per request at p99 batch size" is a finding.

## Verdict

- `approved: true` if no real bottleneck was found at realistic scale.
- `approved: false` with `issues` as a list of `{file, detail, severity}`. `detail` must include the workload that triggers the cost. Severity should track the impact under expected production load.
