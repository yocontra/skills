Deduplicate and merge the audit findings provided in the wrapper message.

## Rules

- Same file + same issue → keep the strongest write-up.
- Same root cause across files → merge and cross-reference.
- Same pattern with different root cause → keep separate.
- Err toward keeping. When in doubt, do not merge.

## Merge Rules for Overlapping Doc Locations

- **Same line range, same staleness class** — collapse to one finding. Keep the entry with the most concrete evidence quote and the cleanest suggested fix.
- **Adjacent lines in the same docstring/block** — merge into a single finding spanning the block. Reference all original line numbers in `evidence`.
- **Same renamed symbol referenced from N files** — keep one finding per file, and name the shared rename in each one's `evidence`. Do not collapse across files.
- **README + sibling skill/doc repeat the same stale CLI flag** — keep both findings, and mention the other file in each one's `evidence`, because the fixes live in different files.
- **Conflicting suggested fixes for the same location** — keep the finding with stronger evidence, and note the weaker fix at the end of its `evidence`.

## Examples

**Example 1 — collapse exact duplicates**

Input:
```json
[
  {"title": "fetch() docstring names retries", "file": "src/api.py", "line": "42", "class": "wrong-params",
   "evidence": "docstring lists 'retries' but signature has 'attempts'",
   "suggestedFix": "rename retries -> attempts"},
  {"title": "param mismatch", "file": "src/api.py", "line": "42", "class": "wrong-params",
   "evidence": "param mismatch in fetch()", "suggestedFix": "fix params"}
]
```
Output: keep the first (stronger evidence + concrete fix), drop the second.

**Example 2 — merge adjacent lines in one docstring**

Input: two findings at `src/api.py:40` and `src/api.py:43`, both flagging the same docstring's stale Returns and stale Raises sections.
Output: one merged finding with `line: "40-43"`, evidence concatenated, single suggestedFix rewriting the docstring.

**Example 3 — keep separate across files**

Input: `docs/cli.md:12` and `README.md:88` both reference removed `--legacy` flag.
Output: keep both findings, each naming the other file in its `evidence`. Different files = different fixes.

## Output Schema

Return `findings` per the structured-output schema, using the finders' field names: `title`, `file`, `line` (a string such as `"42"` or `"40-43"`), `class`, `impact`, `evidence`, and `suggestedFix`. `title`, `file`, `class`, and `impact` are required. You may add `mergedFrom` (the titles of the merged source findings). Do not emit `id`; the engine assigns canonical ids after dedup.

```json
{
  "findings": [
    {
      "title": "fetch() docstring names retries",
      "file": "src/api.py",
      "line": "42",
      "class": "wrong-params",
      "impact": "callers pass retries= and get a TypeError",
      "evidence": "docstring lists 'retries' but signature has 'attempts'",
      "suggestedFix": "rename retries -> attempts",
      "mergedFrom": ["fetch() docstring names retries", "param mismatch"]
    }
  ]
}
```

## Edge Cases

- Findings with identical text but different files → never collapse. Doc fixes are per-file.
- A finding flagged in both a generated file and its source → keep only the source finding; list the generated one in `mergedFrom` and note "auto-generated" in evidence.
- If two findings disagree on whether a line is stale, keep both and let the referee decide. Do not silently drop.
- Empty input → return `{ "findings": [] }`. Do not invent findings.

Return the canonical finding list.
