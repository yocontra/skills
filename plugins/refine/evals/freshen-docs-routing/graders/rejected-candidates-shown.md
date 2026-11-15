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

PASS if the final report the process describes includes, next to the corrections it
applied, a list or table of the suspected items it rejected — candidates that were checked
and found still accurate, and left unchanged — so a reader can see what was examined and
left alone. A described report section that holds those items passes; the response does
not need to list real items, since none can be found here.

FAIL if the described report only ever covers the corrections, or mentions rejected items
only as a count.
