# Merge & Dedup Findings

Merge and dedup the verified PR findings you receive.

## Rules

- Same `path` + `line` + same underlying issue reported by multiple dimensions = ONE finding.
- When merging duplicates, keep the strongest write-up (clearest title, most specific detail, most useful suggestedDiff).
- Take the highest severity across the merged duplicates.
- Take the highest `confidence` across the merged duplicates. Two dimensions independently finding the same issue is corroboration, not a reason to average.
- Preserve `path`, `line`, `startLine`, `tier`, `severity`, `confidence`, `dimension`, `title`, `detail`, and `suggestedDiff` on every surviving finding.
- Take the highest `tier` across merged duplicates (`Bug` > `Quality` > `Nit`).
- Do not invent new findings. Do not soften or upgrade severity beyond what the source findings justify.
- Never invent or adjust a `confidence` score — carry through the highest one you were given.
- If two findings describe related-but-distinct issues at the same location, keep both.
- A tests finding whose only point is that the tests miss a bug another finding already reports ("the tests skip this path, so they pass while the bug ships") is folded into that bug's `detail`, not kept as a second finding. A test that is wrong on its own terms — it cannot fail, it asserts the wrong thing — stays separate.
- The same convention violation in several places (a missing marker, the same banned type, the same naming rule) = ONE finding, anchored on the first location, with every other location listed in `detail`. This is the one case where you merge across files.
- When one finding recommends replacing part of the design, a finding that only refines that part — a test for it, a tuning of it — is subsumed. Fold it into the design finding's `detail` if it still matters after the replacement; otherwise drop it.

## Severity Tie-Breaks

- Tier rank: `Bug` > `Quality` > `Nit`. Order the output by tier, then severity, then confidence.
- Severity rank: `Critical` > `High` > `Medium` > `Low`.
- When merging, the surviving finding takes the highest rank present.
- If two duplicates share the same severity, prefer the one with a `suggestedDiff` over one without.
- If both have a `suggestedDiff`, prefer the one whose `detail` is more specific (cites a function, line, or concrete failure mode) over one that is vague.
- Never average severities. Never downgrade.

## When To Merge vs Keep Separate

Merge when all of the following hold:

- Same `path`.
- Same `line` (or overlapping `startLine`..`line` ranges that point at the same statement / expression).
- Same underlying root cause, even if different dimensions framed it differently (e.g. security calls it "unvalidated input" and bugs calls it "missing null check" on the same param).

Keep separate when any of these hold:

- Different `path` or non-overlapping line ranges.
- Same location but distinct root causes (e.g. one finding is "race condition on `cache`", another is "log message leaks PII" on the same line).
- One is a symptom and the other is the cause at a different site — keep both and let the human link them.

## Examples

Example 1 — merge across dimensions:

Input:
```json
[
  {"id":"a1","path":"src/auth.ts","line":42,"severity":"High","title":"Missing input validation","detail":"`token` is used without checking shape.","suggestedDiff":null},
  {"id":"a2","path":"src/auth.ts","line":42,"severity":"Critical","title":"Auth bypass via malformed token","detail":"Unvalidated `token` flows into `verify()`; a crafted JWT skips signature check.","suggestedDiff":"+ if (!isValidJWT(token)) throw new Error('bad token');"}
]
```

Output: one finding, severity `Critical`, keep `a2`'s title/detail/suggestedDiff.

Example 2 — same line, distinct issues, keep both:

Input:
```json
[
  {"id":"b1","path":"api/log.go","line":88,"severity":"Medium","title":"PII in log","detail":"`user.email` logged at info level."},
  {"id":"b2","path":"api/log.go","line":88,"severity":"High","title":"Unbounded slice growth","detail":"`buf = append(buf, ...)` inside hot loop with no cap."}
]
```

Output: both findings survive — different root causes at the same line.

Example 3 — overlapping ranges, same root cause:

Input:
```json
[
  {"id":"c1","path":"db/query.rs","startLine":10,"line":14,"severity":"Medium","title":"N+1 query"},
  {"id":"c2","path":"db/query.rs","startLine":12,"line":14,"severity":"High","title":"N+1 in user loader","detail":"Each iteration issues a `SELECT`; batch with `IN (...)`.","suggestedDiff":"- for u in users { db.get(u.id) }\n+ db.get_many(users.iter().map(|u| u.id))"}
]
```

Output: one finding, severity `High`, take `c2`'s richer body, widen `startLine` to 10.

## Output Schema

Return the merged findings as a `findings` array, each element in this shape:

```json
[
  {
    "path": "string",
    "startLine": "number (optional, falls back to line)",
    "line": "number",
    "tier": "Bug | Quality | Nit",
    "severity": "Critical | High | Medium | Low",
    "confidence": "number 0-100",
    "dimension": "string — the dimension that found it, or the strongest write-up's dimension when merged",
    "title": "string",
    "detail": "string",
    "suggestedDiff": "string | null"
  }
]
```

Do not include `id` or verifier `reason` text in the output — only the merged finding fields above. `confidence` and `dimension` are carried through; the presented findings show both.

## Edge Cases & Anti-Patterns

- Do not merge findings just because they sit on adjacent lines; require the same root cause.
- Do not drop a higher-severity finding because a lower-severity duplicate has a prettier write-up — merge them.
- Do not collapse findings across files even if the title is identical; per-file context matters. The only exception is one convention violation repeated across files (see Rules).
- Do not invent a `suggestedDiff` by combining partial diffs from two findings; pick one that already compiles.
- If every duplicate lacks `suggestedDiff`, leave it `null` rather than fabricating one.
- Do not average, round, or "reconcile" confidence scores. A 95 merged with a 80 is a 95.
