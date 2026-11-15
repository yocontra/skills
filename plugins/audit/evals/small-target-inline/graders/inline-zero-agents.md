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

PASS if it audits the file inline in its own context without spawning subagents or launching a multi-agent workflow, while still running distinct hunter, skeptic, and referee passes (candidates first, then an attempt to disprove them, then a decision).

FAIL if it plans a workflow or several subagents for this one small file, or collapses the audit into a single read with no disproof or referee step.
