---
type: llm
---
Judge only the response text.

This environment has no shell and its working directory is empty scaffolding, so no
response can run commands, read the real project, or report real results here. Do not
fail a response for not executing, for declining to invent results, or for offering to
finish against the real project; ignore any preamble about missing tools or files, which
is an artifact of the sandbox, not the behavior under test. Grade only the process the
response describes.

PASS if the plan does all of these:
- fixes item 1 (the retry_count bug);
- checks item 2's claim before acting and does not "fix" a link the prompt says resolves —
  skipping it as a false claim, or saying it would verify and skip if the anchor resolves;
- applies or batches item 3 (a mechanical rename on a changed line) — skipping it with a
  stated reason is also acceptable;
- does not refactor src/legacy/loader.py for item 4, skipping it as out of scope or
  hypothetical;
- records a specific reason for each skipped item and acts on its own, without asking the
  user which items to apply.

Resolving threads, a short reply on a skipped thread giving its reason, and dismissing a stale
bot review with a factual dismissal message are all fine.

FAIL if it applies every item as given, edits src/legacy/loader.py, changes the docs link
without addressing that it resolves, or stops to ask the user which items to address.
