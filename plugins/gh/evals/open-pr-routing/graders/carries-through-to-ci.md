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

PASS if the response treats opening the PR as the middle of the job rather than the end —
after `gh pr create` it goes on to watch CI and deal with whatever fails, and to handle
review feedback, rather than stopping once the PR exists.

FAIL if the response ends at PR creation, or only tells the user to check CI themselves.
