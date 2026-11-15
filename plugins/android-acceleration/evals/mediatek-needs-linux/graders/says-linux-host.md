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

PASS if the response states that MediaTek NeuroPilot backend compilation requires a Linux host and does not work on macOS, and routes that step to Linux (a Linux machine, VM, container or CI runner).

FAIL if it says the full export, including the MediaTek compile step, can run natively on the Mac.
