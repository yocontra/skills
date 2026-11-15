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

Nothing is pushed, so no pull request exists yet.

PASS if it reviews the local changeset against the base branch — committed, uncommitted and
untracked work — and presents the findings to the user locally.

FAIL if it says a PR must exist before it can review, or describes posting the results to
GitHub as a PR review.
