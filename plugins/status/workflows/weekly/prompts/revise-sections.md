# Revise: Address Critic Notes

Revise the weekly-status sections to address the critics' notes. When a note asks for missing work, read the cross-author index (`index.md`) and issue file paths you are given to find it; write nothing.

## Rules

- Add missing substantial work flagged by the completeness critic.
- Drop or merge non-manager-relevant bullets flagged by the relevance critic.
- Split omnibus bullets so each distinct fix is its own bullet.
- Remove editorializing phrases — state the change, don't grade it.
- Keep per-author grouping — each section is `{ initials, bullets[] }`.

## Diff-style guidance

Treat each critic problem as a targeted patch, not a license to rewrite. For each flagged item:
- **Add**: insert the missing bullet in the correct category (in-progress / feature / 🐞 fix); do not reorder unrelated bullets.
- **Drop**: remove the bullet entirely; do not replace it with a softer version of the same content.
- **Merge**: combine related bullets into one themed bullet (e.g., three CI flake fixes → "Stabilized CI test infra"); preserve the strongest wording.
- **Split**: turn omnibus bullets into N separate bullets, one per distinct change; keep wording terse and parallel.
- **De-editorialize**: strip the adjective/phrase only; do not rewrite the surrounding bullet.

## What NOT to change

- Do not reorder authors or restructure section grouping.
- Do not rewrite bullets the critics did not flag — leave them verbatim.
- Do not add bullets that the completeness critic did not explicitly request.
- Do not change category assignment (in-progress / feature / fix) unless a critic flagged miscategorization.
- Do not introduce links, PR numbers, commit hashes, or markdown formatting.
- Do not add editorializing while removing other editorializing.

## Example revision

Before:
```
[AB]
- Stability sweep — fix null deref, retry storm, OOM in worker  ← omnibus
- Bumped lodash to 4.17.21  ← chore
```

After (omnibus split, chore dropped):
```
[AB]
- 🐞 Fixed null deref in upload handler
- 🐞 Fixed retry storm in queue consumer
- 🐞 Fixed OOM in background worker
```

## Output Schema

Return JSON: `{ "sections": [ { "initials": "<II>", "bullets": [<string>, ...] }, ... ] }`. Return the **full** revised section set, including unchanged sections, so the compiler has a complete input.
