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

PASS if each claimed stale comment is challenged or independently checked against the
code before it is rewritten, so that comments which turn out to still be correct are left
alone.

FAIL if every comment that looks suspicious is rewritten directly, with no step that can
reject a false positive.
