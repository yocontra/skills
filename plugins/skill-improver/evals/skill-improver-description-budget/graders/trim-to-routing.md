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

PASS if the response says it is not fine as is because the description is loaded into the system prompt of every session whether or not the skill fires, so it should be cut down to routing metadata (trigger phrases and the job in a few words, roughly a few hundred characters or less), with the examples and output-format rules moved into the SKILL.md body or a reference file.

FAIL if it says that being under 1024 characters makes it fine, or if it advises trimming only for readability without saying the examples and rules belong in the body.
