# Performance Audit — Deduplicate

Deduplicate and merge audit findings produced by parallel hunters. The goal is a canonical finding list with no duplicates and no lost evidence.

## Rules

1. **Same file + same issue** — keep the strongest write-up; discard duplicates.
2. **Same root cause across files** — merge into one finding; cross-reference all affected locations in `evidence` and `file`/`line`.
3. **Same pattern with a different root cause** — keep separate findings.
4. **Err toward keeping.** When in doubt, keep both — the skeptic will kill the weak ones.
5. **Combine evidence** when merging: pick the clearest quoted code; preserve the most specific scale/impact analysis.
6. **Preserve metadata.** Keep `class`, `confidence`, `scale`, `impact`, `trigger` from the strongest source.
7. **Never invent.** Do not synthesize a new finding from two weaker ones. Merging picks survivors; it does not create.
8. **Take the worst confidence** when merging. If one source says `static-provable` and another says `needs-runtime-confirmation` for the same finding, keep `static-provable` only if both pieces of evidence support it; otherwise downgrade.

## Merge Mechanics

- When merging, the resulting finding's `file`/`line` becomes a list of all affected sites (e.g. `"src/a.py:42, src/b.py:88"`).
- Concatenate `evidence` blocks if each adds signal. Drop any block that is strictly redundant.
- Use the longest, most specific `scale` and `impact` strings. Do not average or paraphrase.
- Preserve the `title` from the source with the clearest framing.

## Examples

**Example 1 — same N+1 reported twice in same file by two hunters:**
Hunter A flags `users.py:42` "N+1 in get_users". Hunter B flags `users.py:42` "loop issues query per user". → MERGE. One finding, strongest title, combined evidence quote.

**Example 2 — same root cause in two files:**
Hunter A flags missing index on `orders.user_id` via `orders_repo.py:15`. Hunter B flags the same missing index via `reports.py:88`. → MERGE into one finding, `file: "orders_repo.py:15, reports.py:88"`, evidence quotes both call sites.

**Example 3 — superficially similar, different root cause:**
Hunter A: "nested loop O(n^2) in dedupe()". Hunter B: "nested loop O(n^2) in merge()". Different functions, different inputs. → KEEP SEPARATE.

## Anti-Patterns

- Do not merge across confidence tiers when the static-provable finding is genuinely narrower.
- Do not drop a finding just because it overlaps stylistically with another — overlap is not duplication.
- Do not rewrite evidence quotes; copy verbatim from the source finding.

## Output Schema

Return the canonical finding list via structured output, using the same finding schema as the hunters: `title`, `file`, `line`, `class`, `confidence`, `scale`, `impact`, `evidence`, `trigger`.
