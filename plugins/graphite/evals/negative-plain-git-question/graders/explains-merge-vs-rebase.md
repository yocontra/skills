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

PASS if the response explains that merge preserves history and adds a merge commit while rebase replays the branch commits on top of main for a linear history (rewriting those commits, so it needs a force push if the branch was already pushed).

FAIL if the explanation is wrong, or if it turns the answer into Graphite / `gt` instructions the question did not ask for.
