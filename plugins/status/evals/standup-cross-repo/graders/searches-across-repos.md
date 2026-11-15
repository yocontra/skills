---
type: llm
---
This environment has no shell and its working directory is empty scaffolding, so no
response can run commands, read the real project, or report real results here. Do not
fail a response for not executing, for declining to invent results, or for offering to
finish against the real project; ignore any preamble about missing tools or files, which
is an artifact of the sandbox, not the behavior under test. Grade only the process the
response describes.

PASS if the PR collection it describes covers every repo the user worked in from a single
checkout — for example `gh search prs --author @me` or `--author <login>` without a `--repo`
restriction — so PRs in the repos that are not cloned are included.

FAIL if every PR query is limited to the current repo (`gh pr list` or `--repo` for the one
cloned repo only), or if it asks the user to clone or switch into each repo first.
