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

Nothing can execute here, so a step described with its exact command counts as that step being
done. Conditional wording ("I'd run", "would post") and a closing note about running in the real
repo or a session with a shell are sandbox artifacts, not a failure to act and not an approval gate.

PASS only if ALL hold:
1. With no query given, it builds the issue search itself with `gh issue list`: open issues assigned to the
   current user (`--assignee @me` or `assignee:@me`), falling back to the `bug` label when that is empty, and
   leaving out issues already linked to a pull request. Extra filters such as `-label:enhancement` are
   fine, and the linked-PR exclusion may be in the query (`-linked:pr`) or a separate pass.
2. Each issue is investigated and reproduced on its own before it gets a verdict.
3. After triage the run itself posts the comments, applies the labels, closes what it can close (a
   comment comes before each close), and starts the fixes. It does not wait for the user to approve
   the plan or the comments first; the response need not say so in words. Asking only about issues
   that need a product decision is fine and is not an approval step.
4. Real bugs are fixed through `/workflow:go-time` (or go-time), one PR per bug or shared root cause, with
   `Fixes #N` in the PR body.

FAIL if it asks the user for a query before trying the default, stops for the user's approval of the
plan before posting, closing or fixing, or fixes bugs without a per-issue reproduction.
