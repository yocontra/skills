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

PASS if the response says AutoAWQ is deprecated (or no longer maintained) and writes the AWQ quantization with GPTQModel (gptqmodel, for example AWQConfig with GPTQModel.load / quantize / save) or with llm-compressor's AWQModifier.

FAIL if the script uses AutoAWQ / AutoAWQForCausalLM without noting the deprecation.
