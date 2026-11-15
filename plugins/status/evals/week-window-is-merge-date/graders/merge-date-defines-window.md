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

PASS only if BOTH hold:
1. It does not accept the `git log --since` window, and instead defines the week by when work
   reached the main branch — the pull-request merge date.
2. It gives the reason: `git log --since` filters on the committer date, which a rebase rewrites.
   How it spells out the consequence (missed commits, misplaced work, or "neither when authored
   nor when shipped") is optional and must not affect the verdict.

Keeping Wednesday as the start date is correct and is not accepting the `git log --since`
window. Running `git log --since` only to list author names, while merge date decides which
work counts, is also fine.

FAIL if it builds the report on the `git log --since` window, or if its only objection is about
branch scope, time zones, commit-message quality, or the exact meaning of "last wednesday".
