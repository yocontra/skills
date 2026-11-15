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
1. It works from the OpenSpec change's `tasks.md` for the remaining task group.
2. It archives the change (`/openspec:archive`, or the archive with the spec sync) as part of
   this PR, before the PR is opened or merged, so the archive and synced main spec land with it.

FAIL if it leaves the archive for after this PR merges, defers it to a separate follow-up PR,
or never archives the change.
