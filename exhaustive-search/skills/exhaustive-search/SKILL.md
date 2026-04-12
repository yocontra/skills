---
name: exhaustive-search
description: "Systematic search across an entire search space with parallel agent teams. Use when every item must be checked, with no sampling or shortcuts."
---

$ARGUMENTS

# Exhaustive Search

Systematic sweep of an entire search space using parallel agent teams. Every single item gets checked. No sampling, no shortcuts.

**Announce at start:** "Using exhaustive search to sweep [description of search space]."

## When to Use

- Every item in a set must be individually inspected (every file, every API endpoint, every log entry, every query result)
- Sampling or spot-checking is not acceptable — completeness is the requirement
- The search space is enumerable (even if large)

## When NOT to Use

- A grep/glob with a simple pattern answers the question directly
- You only need a representative sample
- The search space is infinite or not enumerable

## Phase 0: Scope the Search Space

Before anything else, enumerate and size the search space.

1. **Define the universe.** State exactly what you are searching. Be precise: "every .ts file under src/", "every row in the query results", "every commit in the last 6 months." Ambiguity here means missed items later.
2. **Count it.** Run a command to get the exact count. Examples:
   - `find src/ -name "*.ts" | wc -l`
   - `git log --oneline --since="6 months ago" | wc -l`
   - `wc -l < results.txt`
3. **Record the count.** State: "Search space: N items."
4. **Assess scale.**

| Size | Action |
|------|--------|
| Under 50 | Single agent can sweep directly. Skip to Phase 2 with 1 partition. |
| 50–500 | Partition into 3–5 groups. Standard parallel sweep. |
| 500–5,000 | Partition into 5–10 groups. Consider coarse-then-fine: first pass identifies areas of interest, second pass deep-dives. |
| 5,000–50,000 | **Warn the user:** "Search space is large (N items). This will require significant time and many agent rounds." Partition into 8–10 groups. Only reduce scope if the user explicitly approves. |
| Over 50,000 | **Warn immediately:** "Search space contains N items. Full exhaustive sweep will require many parallel rounds over an extended period." Partition into 10 groups and iterate in waves. Still proceed — do not give up. |

**Critical rule:** Never silently skip items. If you must reduce scope, get explicit user approval and document exactly what was excluded and why.

## Phase 1: Partition

Divide the search space into non-overlapping partitions that together cover 100% of items.

### Partitioning strategies

| Strategy | When to use | Example |
|----------|-------------|---------|
| **Directory-based** | Codebase searches | One partition per top-level directory |
| **Alphabetical** | Files, names, identifiers | A–F, G–M, N–S, T–Z |
| **Numeric range** | IDs, line numbers, indices | 1–100, 101–200, 201–300 |
| **Category-based** | Heterogeneous items | By file type, by module, by severity |
| **Temporal** | Time-series data | By week, by month, by release |

### Partition requirements

1. **No overlaps.** Every item belongs to exactly one partition.
2. **No gaps.** Every item belongs to at least one partition. Union of partitions = full search space.
3. **Roughly equal size.** Balance so no single agent is stuck with the bulk of the work.
4. **Explicitly listed.** Write out each partition with its exact boundaries and item count:

```
Partition 1: src/api/**       (147 files)
Partition 2: src/auth/**      (83 files)
Partition 3: src/core/**      (201 files)
Partition 4: src/ui/**        (165 files)
Partition 5: src/utils/** + src/config/**  (94 files)
Total: 690 files (matches search space count of 690) ✓
```

5. **Verify the sum.** Partition sizes must sum to the total from Phase 0. If they don't, you have a gap. Find it and fix it before proceeding.

## Phase 2: Execute Parallel Sweep

Launch one agent per partition. Max 10 concurrent — if more partitions are needed, run in waves.

### Agent instructions template

Each sweep agent receives:

```
TASK: Exhaustive check of [partition description]

SEARCH CRITERIA: [what you are looking for / checking for]

YOUR PARTITION: [exact list or pattern of items in this partition]
  Items in partition: [count]

INSTRUCTIONS:
1. Process every item in your partition. No skipping.
2. For each item, check: [specific criteria]
3. Record ALL findings, including negative results.
4. Track your progress: maintain a count of items processed.

REPORT FORMAT:
- Items assigned: [N]
- Items processed: [N] (MUST equal items assigned)
- Findings: [list each finding with the specific item it came from]
- Items with no findings: [count]

If items_processed != items_assigned, your sweep is INCOMPLETE.
Go back and find what you missed.
```

### Execution rules

- **Max 10 agents** at a time to avoid rate limiting.
- If more than 10 partitions, run in waves: first 10, then next batch after wave 1 completes.
- **No agent finishes early by skipping.** An agent that reports fewer items processed than assigned must account for every missing item.
- **Agents report structured results.** Free-form summaries are not acceptable — use the report format above.

## Phase 3: Reconcile

After all agents report back:

1. **Sum the processed counts.** Total items processed across all agents must equal the search space size from Phase 0. If not, identify the gap.
2. **Merge findings.** Combine all agent findings into a single deduplicated list.
3. **Check partition boundaries.** Items at the edges of partitions are most likely to be missed. Spot-check 2–3 items at each partition boundary.
4. **Re-sweep gaps.** If any items were missed, launch a targeted agent to cover only those items.
5. **Produce the final report.**

```
## Exhaustive Search Results

Search space: [description]
Total items: [N]
Items checked: [N] (must match total)
Partitions: [K]
Agents used: [K]

### Findings ([count])
[Each finding with source item and details]

### Coverage Verification
- Partition sum check: ✓ (N₁ + N₂ + ... + Nₖ = N)
- All agents reported complete: ✓
- Boundary spot-checks: ✓
- Gaps found and re-swept: [none / description]

### Completeness Declaration
Every item in the search space was individually checked.
[Or: X items could not be checked because Y — listed below.]
```

## Rules

1. **Never sample.** Check every single item. If that takes 10 rounds of agents, it takes 10 rounds.
2. **Never silently reduce scope.** If you skip anything, document it and get user approval first.
3. **Count in, count out.** The number of items going in must match the number coming out.
4. **Report negatives.** "Checked 200 files, 3 had issues, 197 clean" is a valid report. "Found 3 issues" without stating coverage is not.
5. **When in doubt, re-check.** False negatives are worse than wasted time in an exhaustive search.
