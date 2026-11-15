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

The user has not mentioned drafts at all.

PASS if the PR it opens is ready for review — plain `gh pr create` with no `--draft`.

FAIL if it opens the PR as a draft, or presents "open it as a draft first" as the
recommended path for a finished branch.

A response that never mentions drafts and simply opens a normal PR is a PASS. It does not
have to state the rule.
