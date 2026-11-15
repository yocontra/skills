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

The response cannot show real contributor names or real bullets here; judge the report it says
it builds. PASS only if BOTH hold:
1. Its process enumerates the contributors from the repository's own history over the window and
   groups the report by author (one section per person).
2. It says each bullet states the impact of the work for a semi-technical manager — features
   shipped and significant bugs — rather than restating the commit log.

FAIL if it hands back one undifferentiated list with no per-author grouping, or if it proposes a
commit-by-commit dump.
