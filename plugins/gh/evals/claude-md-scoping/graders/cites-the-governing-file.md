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

Scoping a convention finding is only decidable when the reader can see which `CLAUDE.md` the
rule came from and where that file sits.

PASS if each convention finding it describes is attributed to its governing `CLAUDE.md` by a
repo-relative path, and quotes the rule it breaks rather than paraphrasing it. A described
finding format that carries both, rather than a worked example, satisfies this.

FAIL if findings cite "CLAUDE.md" with no path saying which one, or restate the rule in the
response's own words in place of the text.
