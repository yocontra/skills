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
1. It takes its task list from the change's `tasks.md`.
2. Implementation agents do the code in a worktree, and they never run git.
3. It carries the work through review, the pull request, and CI itself.
4. It merges the PR, or arms auto-merge, once checks are green and review is clean, without asking
   the user first (a blocking label or a required human review it cannot give may stop it).

FAIL if it starts writing the code itself, hands git to the implementation workers, stops
before the pull request, or ends at a green PR and asks the user whether to merge.
