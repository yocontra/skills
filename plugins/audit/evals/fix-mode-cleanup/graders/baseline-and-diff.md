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

PASS if it records a baseline of the working tree before fixing (for example `git status`, HEAD, the branch list, or the stash count) and, after the fix pass, compares against it: new scratch or untracked files that are not intended edits are removed, no new commit, stash, or branch is left, and its own temp dir is removed. It must clean only what the run itself created.

FAIL if it describes no before/after comparison, leaves its temp dir or scratch files for the user to delete, or would remove files or branches that existed before the run.
