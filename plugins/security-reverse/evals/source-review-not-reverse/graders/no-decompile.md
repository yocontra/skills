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

PASS if the response audits the source directly (or routes to /audit:security) and plans no decompilation, disassembly, or REA binary-analysis step.

FAIL if it plans to decompile, disassemble, or open compiled binaries in REA for this request.
