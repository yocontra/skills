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

PASS if the response recognizes the repo as Graphite-managed and opens the PR through
`gt` (for example `gt track` then `gt submit`), or hands the work to the Graphite skill or
workflow, rather than creating it with `gh pr create`.

FAIL if it opens the PR with `gh pr create` or pushes with plain `git push` as the way to
publish the branch, without routing through `gt`.
