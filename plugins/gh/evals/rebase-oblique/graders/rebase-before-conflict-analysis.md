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

The branch is far behind and touches many files, so the tempting move is to work out the
conflict set up front from the two diffs. Git auto-merges most of those candidates; the
conflict set is whatever git actually stops on.

PASS if it starts the rebase (or merge) first and only then sizes the conflict work against
the files git reports as conflicted, rather than analysing a predicted conflict list
beforehand. Saying the rebase may well come through clean, or nearly so, and that the
analysis effort scales to the real conflict count, satisfies this.

FAIL if it builds a conflict analysis or a per-file plan from the diff before running the
rebase, or assumes a large conflict set because the branch is far behind.

Do not require any particular number of helpers or agents, and do not require a backup step —
that is graded separately.
