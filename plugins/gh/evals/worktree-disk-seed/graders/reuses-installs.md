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

PASS if the frontend `node_modules/` in each worktree is cloned or seeded from the main checkout
(when the lockfile matches) instead of installed from scratch, and the response does not then run
`npm ci` over that seeded tree, which would delete it.

FAIL if it runs `npm ci` or a fresh `npm install` in every worktree with no reuse.
