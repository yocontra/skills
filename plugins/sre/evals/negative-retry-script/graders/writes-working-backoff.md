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

PASS if it gives a bash function that retries the curl up to five times and doubles the wait
between attempts.

FAIL if it gives no function, or if the wait does not grow between attempts.

Do not require any particular error handling or logging.
