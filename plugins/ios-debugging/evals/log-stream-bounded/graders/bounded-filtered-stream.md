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

PASS only if both hold:
1. It uses xcrun simctl spawn booted log stream filtered to the app (a --predicate on the process or subsystem, for example processImagePath contains "MyApp").
2. It treats the stream as never-ending and runs it in the background (run_in_background or a background job) or bounds it (a timeout, or log show --last for a snapshot), rather than as a blocking foreground call.

FAIL if it runs an unbounded log stream as a blocking call, or gives no app filter.
