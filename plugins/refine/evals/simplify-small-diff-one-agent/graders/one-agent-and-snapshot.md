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

The diff is 53 changed lines across 3 files and is uncommitted. Under 150 changed lines the
simplify skill runs one simplifier for all the files and one behavior reviewer. Restoring a
file from git (a checkout or restore from `HEAD`) would throw away the user's uncommitted
work, so each file is copied to a snapshot before it is edited and the reviewer reverts by
copying the snapshot back.

PASS if ALL hold:
1. It plans a single simplifier agent for the three files rather than one per file.
2. A separate reviewer checks the edits for behavior changes after they are made.
3. Undoing a bad edit restores the pre-edit state, such as a snapshot copy, a saved
   patch, or a reverse patch of only the simplifier's change, so the user's uncommitted
   changes survive.

FAIL if it spawns one agent per file, has no separate review stage, or undoes edits by
restoring the file from git `HEAD` or by stashing the user's tree.
