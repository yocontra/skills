# Deduplicate audit findings

Deduplicate and merge the supplied audit findings (JSON in PARAMETERS). Multiple hunters often surface overlapping issues with slightly different framing — your job is to collapse them into a single canonical list without losing detail or evidence.

## Rules

- **Same file + same issue** = keep the strongest write-up.
- **Same root cause across different files** = merge into one finding and cross-reference all affected locations.
- **Same pattern with different root cause** = keep separate.
- For dependency findings, prefer `tool-verified` over `training-data-only` when merging duplicates.
- Same package + same CVE = always merge, even if hunters cited different vulnerable functions — combine the call sites in `evidence` and list them in `affectedFiles`.
- Same package + different CVE = keep separate findings, one per CVE.
- Hunters assign no severity (the referee does), so there is nothing to rank by severity here.
- Concatenate distinct evidence; do not drop quotes, line numbers, or proof sketches.
- Err toward keeping — let the skeptic kill the weak ones.

## Examples

### Example 1 — same SQL injection, two hunters

Input: hunter-A reports `SQLi in /api/users` citing line 42; hunter-B reports `Unsanitized query in users handler` citing lines 40-44.
Output: one finding with the stronger title, `file: "api/users.js"`, `line: "40-44"`, evidence merged.

### Example 2 — same root cause, multiple files

Input: three findings about a shared `buildQuery()` helper used by `users.js`, `orders.js`, `admin.js`.
Output: one finding whose `file` is the helper, with `affectedFiles` listing all three callers.

### Example 3 — dep CVE merge

Input: hunter-A flags `lodash@4.17.20 — CVE-2021-23337` as `training-data-only`; hunter-B flags the same CVE from `osv-scanner` output as `tool-verified` and lists two call sites.
Output: one finding with `confidence: "tool-verified"`, both call sites in `evidence` and `affectedFiles`, and hunter-A's reasoning folded into `evidence`.

## Output Schema

Return `findings` per the structured-output schema, using the hunters' field names so that nothing downstream loses data. Each element keeps every field present in its sources: `title`, `file`, `line`, `class`, `impact`, `evidence`, and the security fields `type`, `confidence`, `cve`, `package`, `fixedIn`, `attackVector`, `proofSketch`. Copy `type` and `confidence` exactly: the engine assigns `DEP-` ids from `type: "dependency"` and downgrades any dependency finding whose `confidence` is not `tool-verified`. You may add:

- `mergedFrom` — the titles of the source findings that were merged.
- `affectedFiles` — other `path:line` locations, when the finding spans files.

Do not emit `id`. The engine assigns canonical ids after dedup.

```json
{
  "findings": [
    {
      "title": "CVE-2021-23337 in lodash@4.17.20",
      "file": "src/render.js",
      "line": "12",
      "class": "command injection",
      "type": "dependency",
      "confidence": "tool-verified",
      "cve": "CVE-2021-23337",
      "package": "lodash",
      "fixedIn": "4.17.21",
      "attackVector": "user-supplied template string reaches _.template",
      "impact": "remote code execution in the render worker",
      "evidence": "_.template(req.body.tpl)",
      "affectedFiles": ["src/email.js:30"],
      "mergedFrom": ["CVE-2021-23337 in lodash@4.17.20", "lodash template injection"]
    }
  ]
}
```

## Edge Cases

- Two findings cite the same line but describe genuinely different bugs (e.g. SQLi and a separate auth bypass on the same handler) — keep both.
- A finding has no overlap with anything else — pass it through unchanged.
- Do not invent new findings, infer issues that no hunter reported, or rewrite evidence beyond merging.
