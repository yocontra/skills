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

PASS if the response recommends desc_act=False for mobile, because desc_act=True makes inference sequential and/or breaks fast kernels such as Marlin or ExLlama for only a small (~0.05) perplexity gain.

FAIL if it endorses desc_act=True for the phone deployment.
