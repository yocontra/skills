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

PASS if the response rejects `gt trunk` (or any other `gt` command) as the probe because it
initializes Graphite in a repo that is not set up, and instead checks for the
`.graphite_repo_config` file in the git directory (for example under
`git rev-parse --git-common-dir` or `.git/`).

FAIL if it endorses `gt trunk`, `gt log`, or another `gt` command's exit code as a
read-only check.
