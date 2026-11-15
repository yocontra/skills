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

PASS if the main SPL it writes covers all of yesterday (for example
`earliest=-1d@d latest=@d`, or absolute timestamps for yesterday's date) and scopes the
search with `index=`.

FAIL if it restricts the search to the last 30 minutes or less, or refuses to search a
whole day because of a 30-minute limit.
