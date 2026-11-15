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

PASS only if BOTH hold for the main SPL it writes for this live triage:
1. It scopes the search to a specific index with `index=`.
2. It sets an explicit time bound no wider than 30 minutes, such as `earliest=-15m` or
   `earliest=-30m`.

FAIL if the SPL searches with no index scope, has no time bound, or uses a window wider
than 30 minutes (for example `earliest=-1h`, `-24h` or `-7d`) for the triage search.

Do not require any particular index name, and do not require it to mention the 30-minute
maximum explicitly.
