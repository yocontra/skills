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
1. #333: a root-cause comment and a progress label when its fixer is dispatched, a go-time run that
   opens a PR whose body says `Fixes #333` (so the merge closes the issue), and the progress label removed
   once the PR merges or the unit otherwise ends.
2. #444: a comment that names the fixing commit or PR, when it merged, and the first release with it,
   then the run closes the issue as completed itself, without asking for approval. No new fix.

FAIL if #333 is closed by hand instead of through the PR, the progress label is never removed, or #444
gets a new fix, or if either write waits on the user's approval.
