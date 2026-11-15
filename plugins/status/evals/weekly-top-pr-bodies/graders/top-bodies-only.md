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

PASS only if ALL hold:
1. It reads the title of every PR in the window.
2. It reads PR bodies only for a limited set per author, their top merged PRs (by size or
   scale), optionally plus PRs flagged as security, auth, data-loss or outage work, and
   trims each body to its rationale.
3. Its `gh pr list` calls do not include `body` in the `--json` fields.

FAIL if it fetches bodies for every PR, puts `body` in a `gh pr list --json` projection,
or reads no PR bodies at all.
