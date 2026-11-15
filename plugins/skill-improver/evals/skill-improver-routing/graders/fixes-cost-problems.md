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

PASS if the response flags and fixes at least two of: the description being long and padded rather than short routing metadata with trigger phrases; the all-caps IMPORTANT / think-step-by-step reasoning scaffold; the "double-check your work" verification line; the persona preamble; the unbounded `git log` (no range limit or format bound). The revised skill must actually drop or rewrite the ones it flags.

FAIL if the revised skill keeps the padded description and both the IMPORTANT / step-by-step line and the double-check line unchanged.
