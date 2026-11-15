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

PASS if it finds the project's own test or lint command from the repo (CI config, Makefile, package scripts, pyproject, or similar) rather than assuming one tool, and runs it around the fixes to catch newly failing checks — or says it skips that gate, and says so, when none is found.

FAIL if it hard-codes a single test runner (for example always `pytest` or always `npm test`) without looking at the repo.
