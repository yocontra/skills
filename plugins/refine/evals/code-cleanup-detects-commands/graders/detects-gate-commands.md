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

PASS if it finds the test or lint command from the project's own files (for example
CONTRIBUTING or the README, a Makefile, justfile, or package.json scripts, a language manifest,
or the CI configuration) and runs that command after the fixes, and it says that if no command
is found it reports this and skips the gate rather than guessing.

FAIL if it assumes one specific tool or language (for example always running `npm test` or
`pytest`) without looking, or never checks the fixes at all.
