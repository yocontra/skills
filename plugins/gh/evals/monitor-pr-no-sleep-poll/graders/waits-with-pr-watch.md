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

PASS if it waits on the PR with one blocking watcher run in the background (the plugin's
`pr-watch.sh`, or a described equivalent that returns on a failed check, all-green, or new
feedback) and acts when it returns, instead of a fixed sleep loop.

FAIL if it adopts the ten-minute sleep-and-check loop, or any timed wait between 5 and 20
minutes, as the way to wait.
