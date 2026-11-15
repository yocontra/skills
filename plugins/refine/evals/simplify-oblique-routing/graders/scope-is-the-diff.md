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

PASS if the set of files it works on is the ones changed in the current working tree —
resolved from the version control diff, or from what the user changed this session — and
untouched files elsewhere in the project are left out.

FAIL if it plans to sweep the whole project, or never bounds the file set at all.
