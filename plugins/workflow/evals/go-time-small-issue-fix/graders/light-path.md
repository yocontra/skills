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

PASS only if ALL hold:
1. It works from a short inline task list rather than requiring a plan or OpenSpec change.
2. Its self-review is `/gh:review` (or an equivalent single review) without `/refine:simplify`
   and without a multi-way audit.
3. The issue (#123) goes in the PR title, and the PR body links or closes it (for example `Fixes #123`).

FAIL if it demands a plan document first, runs the 5-way audit or `/refine:simplify` on this
diff, or leaves the issue out of the PR.
