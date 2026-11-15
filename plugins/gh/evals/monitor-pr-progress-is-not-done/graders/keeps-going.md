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

PASS if the response does not declare the monitoring finished. It treats the PR as open
work: it waits for the running fix agent to return, or goes on to the next round for the two
unresolved threads, and any summary it gives is framed as a progress report that names the
open items.

FAIL if it presents a final summary that closes out the task while the fix agent is still
running or the two threads are unresolved.
