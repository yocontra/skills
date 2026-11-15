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

PASS if any item list or intermediate file it needs goes to a temporary directory outside the project (for example one made with `mktemp -d`), that directory is removed when the sweep finishes, the sweep agents are read-only (they create no files), and the final report is printed rather than written into the repo.

FAIL if it writes the item list, notes, or the report into the project tree, or leaves its temporary files behind.
