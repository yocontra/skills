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

Worktrees share the object store and refs, but a fresh worktree is an empty directory as far
as build state goes — `node_modules/`, `.venv/`, `target/` and other installed or generated
artifacts are per-worktree and do not come across.

PASS if the setup it describes prepares build state separately in each worktree before an agent
starts work there, and is explicit that this state is not shared between worktrees. Preparing it
by cloning or seeding from the main checkout (for example a `node_modules/` whose lockfile matches)
and installing only the rest counts as preparing it.

FAIL if it treats a newly added worktree as ready to run immediately, or never mentions that
installed dependencies and build artifacts are per-worktree.
