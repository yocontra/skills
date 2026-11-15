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

PASS if the response scales its conflict-resolution effort to the number of files git
actually reports as conflicted — no analysis work at all when the rebase is clean, a
small effort for a few conflicts, and more parallel analysis for a large conflict set.
Naming explicit tiers or agent counts is one way to satisfy this, but any scheme that
ties the work to the real conflict count qualifies.

FAIL if it applies one fixed procedure regardless of conflict count, or plans a full
conflict analysis before knowing whether the rebase conflicts at all.
