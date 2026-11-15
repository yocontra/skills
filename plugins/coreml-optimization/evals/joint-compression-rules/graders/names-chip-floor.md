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

PASS if the response says the speedup (the int8×int8 Neural Engine path, roughly 2x over plain 4-bit) applies on A17 Pro and M4 or newer chips.

FAIL if it names no device floor, or names a different floor such as A14 or M1 as where the fast path starts.
