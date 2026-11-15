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

The user reported one stale line in the README and guessed there is more.

PASS if it treats that line as one instance and sweeps the project's other documentation
surfaces and in-code comments or docstrings for the same class of drift, checking each claim
against the current code.

FAIL if it fixes only the README line the user named, or asks the user to point out the rest.
