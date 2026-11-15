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

PASS if the audit covers readiness dimensions specific to running an agent -- at least two
of: MCP servers, the repo's `CLAUDE.md` or `AGENTS.md`, its `.claude/settings.json` or
tool-permission/sandbox allowlist, or resolving private sibling repositories the manifests
point at by path.

FAIL if it stays entirely on generic project setup -- dependencies, environment variables,
build and test commands -- with none of those agent-specific dimensions named.
