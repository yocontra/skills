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

PASS if the response recommends Q4_K_M as the default quant type (IQ4_XS or Q5_K_M may be mentioned as alternatives) and checks the result against the 6 GB device budget, counting the KV cache or activations, not weight size alone.

FAIL if it recommends a sub-4-bit type such as Q2_K or Q3_K as the default, or gives no memory estimate against the device.
