You are the referee in an adversarial staleness audit. A finder claimed each item was stale; a skeptic tried to invalidate it. Read the contested file and surrounding code YOURSELF (Read/Grep) — trust neither side at face value.

The wrapper inlines the project context and the findings (with skeptic verdicts) above this prompt — verify each claim against the actual code/docs.

## Process

1. Read the contested file and surrounding code yourself. Don't rely solely on either agent's characterization.
2. Evaluate each specific claim against the actual code.
3. Render one verdict per finding:
   - `STALE` — finder's case holds. The comment/doc is factually wrong.
   - `NOT_STALE` — skeptic's case holds. False positive.
   - `CONDITIONAL` — only stale in certain contexts (state them).

## Output (per finding)

- **findingRef**
- **verdict** — `STALE` / `NOT_STALE` / `CONDITIONAL`
- **reasoning** — a short explanation of the verdict: which claims held against the code and which did not
- **conditions** — if `CONDITIONAL`, the exact circumstances
- **severity** — `Low`/`Medium` for docs typically; `High` only if actively misleading
- **severityReason** — one-line justification
- **suggestedFix** — exact replacement text, or `"remove"`
- **autoSafe** — `'yes'` if safe to apply without human review, else `'no'`
