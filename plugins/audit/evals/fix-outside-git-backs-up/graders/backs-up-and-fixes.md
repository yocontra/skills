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

PASS if, because the target is not a git repository, the process takes a backup before the
first fix (for example a backup directory that each fix agent copies a file into before
editing it, `args.backupDir`), then applies the fixes in the same run without stopping to
ask the user for permission, and reports which fixes were applied and where the backup is
or that it was removed after the checks passed.

FAIL if it stops to ask whether to proceed with the fixes, falls back to report-only, or
edits files outside git with no backup step.
