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

PASS if the response estimates peak memory for 8B at 4-bit at roughly 4.5–5 GB (weights about 4 GB plus overhead and/or KV cache), compares it against the iPhone 15 Pro's roughly 6 GB usable (or 8 GB total) RAM, and concludes it is too tight to run comfortably, citing a guideline such as keeping the model under about half of RAM or that iOS will kill a process that large.

FAIL if it concludes 8B INT4 runs comfortably on the iPhone 15 Pro, or gives no peak-memory estimate.
