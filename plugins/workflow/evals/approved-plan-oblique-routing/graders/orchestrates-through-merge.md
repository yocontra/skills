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

PASS only if BOTH hold:
1. It orchestrates rather than implements — parallel implementation agents do the code, then a
   review of the changes.
2. It carries the work through the pull-request lifecycle itself: commit, open the pull request,
   handle checks and review feedback, then merge or arm auto-merge.

FAIL if it starts writing the code itself, or if it stops at "the code is written" without the
pull-request and merge stages.
