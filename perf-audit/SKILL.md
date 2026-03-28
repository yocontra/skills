---
name: perf-audit
disable-model-invocation: true
description: |
  Three-agent adversarial performance audit system.
  Use when asked to find performance issues, run a perf audit, or optimize slow code.
---

# Performance Audit Skill

Run a three-agent adversarial performance analysis that produces a high-confidence set of real performance issues.

## How It Works

Three agents with competing incentives:

1. **Perf Hunter** — finds the superset of all plausible perf issues (+1 low, +5 medium, +10 critical)
2. **Adversary** — challenges every finding (gets the issue's score if disproved, -2x if wrong)
3. **Referee** — judges both sides (+1 correct, -1 incorrect)

## Target

The user specifies what to audit. Examples:

- `perf-audit git diff` — audit the current git diff
- `perf-audit the map rendering pipeline` — audit map rendering code
- `perf-audit mobile/src/hooks/` — audit a specific directory

If the user doesn't specify a target, **ask them what to look at** before proceeding. Do not default to scanning the entire codebase.

## Steps

1. **Explore** the specified target looking for:
   - Unnecessary recomputation and missing caching/memoization
   - N+1 queries and missing DB indexes
   - Unbounded collections, missing pagination or virtualization
   - Large imports, unnecessary dependencies, and dead code
   - Blocking the main thread or event loop
   - Memory leaks (listeners, subscriptions, closures, unclosed resources)
   - Unoptimized assets and missing caching
   - Expensive computations in hot paths (tight loops, animation callbacks, request handlers)
   - Missing debounce/throttle on frequent events
   - Redundant network requests and missing deduplication
   - Synchronous I/O or heavy work on startup/critical path
   - Inefficient data structures or algorithms for the access pattern
   - Lock contention, thread pool exhaustion, or connection pool starvation

2. **Perf Hunter agent** — produce a numbered list of every plausible performance issue with severity, file paths, line numbers, code evidence, and estimated impact (latency, memory, CPU, battery). Be hyper-enthusiastic. Include even uncertain findings.

3. **Adversarial agent** — challenge every issue. Read the actual source for each one. Disprove false positives (code that looks slow but isn't in a hot path), flag duplicates, and downgrade overstated severities. Only disprove when you have strong evidence.

4. **Referee agent** — read disputed code yourself. For each issue, rule: REAL ISSUE / NOT AN ISSUE / DOWNGRADED / UNCERTAIN. Provide confidence level and evidence. Consider whether the code is actually in a hot path.

5. **Return the findings** directly in your response (do not write to a file).

## Output Format

Structure your response as:

- **Process** — Table of agent roles and scoring
- **Confirmed Issues** — For each: severity, confidence, files, evidence, impact category (latency/memory/CPU/battery/startup), estimated magnitude, fix
- **Dismissed Findings** — Table: ID, claim, why dismissed
- **Shared Root Causes** — Common patterns across issues (e.g. missing memoization strategy, no query optimization layer)

## Rules

- Every claim must reference actual file paths and line numbers
- Agents must read source code, not guess
- Severity levels: CRITICAL / HIGH / MEDIUM / LOW
- Confidence levels: HIGH / MEDIUM / LOW
- Impact categories: LATENCY / MEMORY / CPU / BATTERY / STARTUP / BUNDLE SIZE
- Hot-path analysis is required — an expensive operation that runs once on startup is different from one in a render loop
- The goal is highest-confidence issues with real user impact, not the longest list
