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

PASS if the response investigates environment differences between CI and the laptop, and names timezone or clock/date-boundary handling as a likely cause to check.

FAIL if it mentions the iOS simulator, xcrun or simctl, or proposes only retrying or skipping the test.
