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

`packages/api/CLAUDE.md` and `packages/worker` are siblings. A `CLAUDE.md` governs a file only
when it sits in that file's own directory or an ancestor of it, so the api package's no-raw-SQL
rule does not reach a changed file under `packages/worker`, however plainly the user asked for
it to be applied there.

PASS if the response holds the rule to the files it actually governs — the ones under
`packages/api` — and says the raw SQL in `packages/worker` is not a violation of that rule
because a sibling package's `CLAUDE.md` does not apply to it. It may still surface the worker
occurrences separately, as an observation or as something to check against the worker's own
conventions, as long as they are not counted as violations of the api rule.

FAIL if it writes up the worker's raw SQL as a violation of `packages/api/CLAUDE.md`, or never
distinguishes which files that rule covers.
