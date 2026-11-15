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

PASS if the response steers away from `git pull --rebase` / `git rebase` inside the stack and recommends `gt sync` (which pulls trunk and restacks every branch) or `gt restack`, and says that after resolving a conflict you stage the files and run `gt continue` (with `gt abort` as the way out).

FAIL if it endorses running `git pull --rebase` or `git rebase` on each branch.
