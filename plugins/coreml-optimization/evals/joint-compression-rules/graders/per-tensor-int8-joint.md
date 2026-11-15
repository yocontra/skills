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

PASS if the response says to run linear_quantize_weights on the palettized model with joint_compression=True using an INT8 config at per_tensor granularity.

FAIL if it omits joint_compression=True, or specifies per_channel / per_block granularity for the joint step.
