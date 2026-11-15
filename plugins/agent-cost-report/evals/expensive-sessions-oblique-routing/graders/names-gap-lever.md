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

PASS only if BOTH hold:
1. It measures spend from the session transcripts with a report script rather than guessing.
2. It names the lever for long sleeps: stop sleep-polling and use background commands
   (`run_in_background`) or wait for notifications instead. Explaining the prompt-cache
   mechanism is welcome but not required.

FAIL if it gives only generic cost tips without measuring, or keeps the sleep loops.
