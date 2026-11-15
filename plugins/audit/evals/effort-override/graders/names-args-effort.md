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

PASS if it says the roles have their own effort defaults (skeptics and referees run higher
than recon or dedup) and that one role can be raised through the workflow's `args.effort`
override, for example setting the hunter to `high`.

FAIL if it says effort cannot be set per role, or only offers raising the effort of the
whole session.
