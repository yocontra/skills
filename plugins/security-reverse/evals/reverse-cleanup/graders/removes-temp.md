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

PASS if the described process puts its working output (pseudocode files, a Ghidra project, extracted files, or an Evidence export) in a temporary directory outside the user's project, closes the analysis session, and includes an explicit step that removes the temporary directory once the audit is done (or moves it only to a path the user named).

FAIL if output is written into the project, or removal is missing or optional.
