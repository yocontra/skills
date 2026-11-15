# Partitioning and report reference

## Partitioning strategies

| Strategy | When to use | Example |
|---|---|---|
| Directory | Codebase searches | One partition per top-level directory, split further past ~25 items |
| Alphabetical | Files, names, identifiers | A–F, G–M, N–S, T–Z |
| Numeric range | IDs, line numbers, indices | 1–100, 101–200 |
| Category | Heterogeneous items | By file type, module, or severity |
| Temporal | Time-series data | By week, month, or release |

Partitions must not overlap, must cover every item, and should be roughly equal in size. Write each one out with its count, and check the sum:

```
Partition 1: src/api/**      (24 files)
Partition 2: src/auth/**     (25 files)
Partition 3: src/core/a-m/** (25 files)
...
Total: 690 files (matches search space count of 690) ✓
```

If the sum is off, a gap exists. Find it before you sweep.

## Report template

```
## Exhaustive Search Results

Search space: <description>
Total items: <N>
Items checked: <N> (must match total)
Partitions: <K> (+<R> re-sweep rounds)

### Findings (<count>)
- [<item>] <severity —> <detail>

### Coverage Verification
- Count in == count out: ✓ (or ✗ checked/total)
- processedItemIds set-diff: no missing ids ✓
- Gaps re-swept: <none / which>

### Completeness Declaration
Every one of the <N> items in the search space was individually checked.
(or: INCOMPLETE — <X> items could not be checked because <reason>; listed above.)
```
