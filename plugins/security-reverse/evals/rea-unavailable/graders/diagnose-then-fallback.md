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

PASS if the response diagnoses the missing REA connection (a rea-agents doctor command or equivalent registration check), handles any configuration repair by showing a setup dry-run plan before applying it, and still carries the audit through: either with REA once reconnected, or with a named fallback decompiler such as headless Ghidra, while stating that REA was unavailable.

FAIL if it silently drops REA with no diagnosis, applies setup or installs software without first showing a dry-run plan, or stops without any analysis plan.
