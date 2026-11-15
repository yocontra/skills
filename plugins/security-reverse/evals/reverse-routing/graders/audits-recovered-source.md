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

The REA MCP server is not connected in this environment either. A response that writes out the REA tool calls it would make, or diagnoses REA and falls back to another decompiler, counts as decompiling.

PASS if the described process recovers code from the binary and then runs an adversarial audit over it (hunters or finders, a skeptic or disprover, and a referee, or /audit:security) before reporting findings, and findings are tied to concrete evidence such as function names, addresses, or call paths.

FAIL if it reports vulnerabilities straight from decompiler output or strings with no separate verification pass.
