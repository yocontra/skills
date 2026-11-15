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

PASS if it names a way to make each verify agent cheaper or to run fewer of them that the
uplift workflow supports: passing a cheaper model for the verify agents (the `verifyModel`
argument, for example `"sonnet"` or `"haiku"`), or narrowing the audit with `--quick` or
`--service <name>`. Naming the cheaper model as the main lever is enough.

FAIL if it suggests only generic cost advice (shorter prompts, fewer files) with no verify
model or narrowing option, or proposes dropping the per-requirement probes entirely.
