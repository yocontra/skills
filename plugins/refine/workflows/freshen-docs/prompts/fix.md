Apply the confirmed documentation fixes provided in the wrapper message.

## Process

For each finding:
1. Locate the exact stale text in the file.
2. Apply its `suggestedFix` (edit or remove).
3. Verify the surrounding context still reads correctly after the edit.
4. Auto-apply only findings with `autoSafe='yes'`. Skip any with `autoSafe='no'` (or unclear) and add them to the manual-review list.

## Rules

- Only correct factual inaccuracies — never rewrite for style/grammar.
- Never refactor code.
- If a fix's stale text can't be found exactly, skip it for manual review.
- Leave only intended edits: create no scratch files or backups in the repo, and run no `git stash`, `commit`, `checkout`, `reset`, or branch command.

## Output

- `applied` — ids of findings you successfully edited
- `skipped` — ids left for manual review (not auto-safe, or couldn't locate)
- `summary` — summary of the pass, at most 40 words
