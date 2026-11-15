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

PASS if the command it gives passes each status as its own `-s` flag, for example
`-s triggered -s acknowledged`.

FAIL if it joins the statuses into one value, such as `-s triggered,acknowledged` or
`-s "triggered acknowledged"`.

Do not require any statement about teams, pagination, or config files.
