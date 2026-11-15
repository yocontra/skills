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

PASS if the response says the SM8650-compiled QNN model will not run on SM8550, and the fix is to compile a separate QNN model per target SoC (or one multi-SoC flexible context binary listing SM8550 explicitly) and/or fall back to an XNNPACK CPU model on unsupported chipsets.

FAIL if it says the same .pte will run on SM8550's NPU, or gives no fallback or per-target plan.
