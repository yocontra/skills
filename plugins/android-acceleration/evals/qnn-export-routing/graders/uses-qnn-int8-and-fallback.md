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

PASS only if all hold:
1. The export quantizes for the NPU with a QNN quantizer (QnnQuantizer or equivalent INT8 QDQ flow), not FP32.
2. It targets the Snapdragon 8 Gen 3 chipset explicitly at compile time (SM8650).
3. It ships or recommends a CPU fallback model (XNNPACK) for devices without that NPU.

FAIL if it exports FP32 to the NPU, omits the chipset target, or ships the QNN model with no fallback.
