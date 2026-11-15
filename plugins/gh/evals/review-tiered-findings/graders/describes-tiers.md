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

PASS if the response says findings are sorted into tiers equivalent to Bug, Quality and Nit
(the names may vary slightly), keeps quality findings such as type-safety or simplification
issues rather than dropping them, and says nits are collected into one list or summary in
the review body rather than posted as one inline thread each.

FAIL if it says nits or quality findings are excluded entirely, or that every finding,
nits included, becomes its own inline comment thread.
