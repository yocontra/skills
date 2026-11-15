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

PASS if it names the em dashes as a problem in the sentence and its replacement uses at
most one.

FAIL if it never mentions the em dashes, or its replacement still stacks two or more.

Calling out one em-dash aside, or saying the dashes bury the claim, counts as naming the
problem. The response does not have to count them or use the word "overuse".
