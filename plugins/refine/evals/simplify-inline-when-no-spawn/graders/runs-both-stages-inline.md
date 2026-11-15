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

The caller is a forked worker that cannot spawn agents. The simplify skill then runs both
stages inline, in sequence, in its own context: copy each file to a snapshot, simplify,
then review every edit for behavior changes by diffing against the snapshot, and revert a
bad edit by copying the snapshot back. Restoring from git `HEAD` would discard the user's
uncommitted work.

PASS if ALL hold:
1. The simplify runs in the caller's own context rather than in spawned agents.
2. A distinct behavior-preservation review stage checks the edits after they are made.
3. Undoing a bad edit restores a pre-edit copy (a snapshot, saved patch, or reverse patch
   of only the simplifier's change), so the user's uncommitted changes survive.

FAIL if it retries spawning agents, asks someone else to spawn them, skips the review
stage, or undoes edits by restoring from git `HEAD` or by stashing the user's tree.
