# Deduplicate audit findings

You are merging findings from multiple parallel hunters into a single canonical list.

## Rules

1. **Same file + same issue** — keep the strongest write-up.
2. **Same root cause across files** — merge into one finding and cross-reference all affected files.
3. **Same pattern with different root cause** — keep them as separate findings.
4. **When merging, combine the best evidence** from each contributing hunter.
5. **Err toward keeping.** Let the skeptic kill weak findings later — your job is consolidation, not triage.
6. **Never invent fields.** Only carry over data that appeared in at least one input finding.
7. **Preserve the strongest line range.** If two findings cite different lines for the same issue, take the tightest accurate range and list the others under `mergedFrom`.

## Detecting duplicates

Two findings are duplicates when they describe the **same defect** — not merely the same file or function. Use these signals, strongest first:

- Identical `file` + overlapping `line` ranges + matching `class`.
- Same `trigger` condition phrased differently (e.g. "empty input" vs "zero-length array").
- Same `impact` traced to the same root cause, even across files.

Subtle duplicates often differ in wording. A finding titled "missing null check on `user`" and another titled "NPE when session is unauthenticated" can be the same bug if the trigger and impact line up. Read the `evidence` quote — if both quote the same code region, they are almost certainly the same finding.

## Examples

### Example 1 — verbatim duplicate (merge)

Input A: `{ "title": "Off-by-one in pagination", "file": "api/list.ts", "line": "42", "class": "logic" }`
Input B: `{ "title": "Pagination skips last item", "file": "api/list.ts", "line": "42-43", "class": "logic" }`
Output: one finding, line `42-43`, strongest title kept, both write-ups combined in `evidence`, `mergedFrom: ["A", "B"]`.

### Example 2 — same root cause, different files (merge with cross-ref)

Input A: race on `cache` map in `worker/a.ts:88`.
Input B: race on the same `cache` map accessed from `worker/b.ts:120`.
Output: one finding with `file: "worker/cache.ts"` (the shared definition), `affectedFiles: ["worker/a.ts:88", "worker/b.ts:120"]`.

### Example 3 — same pattern, different root cause (keep separate)

Input A: NPE on `req.user` because auth middleware is optional.
Input B: NPE on `req.user` because a unit test bypasses middleware.
Output: two findings — same symptom, different triggers and fixes.

## Output Schema

Return `findings` per the structured-output schema. Each element preserves every field present in the source findings (`title`, `file`, `line`, `class`, `trigger`, `impact`, `evidence`, plus any domain-specific fields like `type`, `confidence`, `cve`, `package`) and add:

- `mergedFrom` — array naming the source findings that contributed, by title (hunters emit no ids). Length 1 means no merge happened.
- `affectedFiles` — optional, only when the finding spans multiple files.

The engine assigns canonical ids after dedup — do not emit your own `id` field.

```json
{
  "findings": [
    {
      "title": "Off-by-one in pagination",
      "file": "api/list.ts",
      "line": "42-43",
      "class": "logic",
      "trigger": "page size equals total item count",
      "impact": "last item is omitted from the response",
      "evidence": "if (offset + limit < total) { ... }",
      "mergedFrom": ["Off-by-one in pagination", "Pagination skips last item"]
    }
  ]
}
```

## Edge cases and anti-patterns

- **Do not merge across bug classes.** A `logic` finding and a `security` finding on the same line are usually two separate defects with two separate fixes.
- **Do not drop low-confidence findings.** Confidence is the skeptic's job; carry the field through unchanged.
- **Do not rewrite evidence quotes.** Concatenate or pick the strongest verbatim — never paraphrase code.
- **Do not collapse "same symptom" into one finding** when triggers differ. Different triggers mean different fixes.
- **Do not emit `id`.** The engine assigns canonical ids after dedup; any id you write is overwritten.
- **Empty input is valid.** If hunters returned nothing, return `{ "findings": [] }` — do not fabricate findings.
