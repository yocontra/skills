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

`gh search issues` has no `milestone` JSON field; asking for one makes the command fail with
"Unknown JSON field". Milestones come from `gh issue view <url> --json milestone`,
`gh issue list --repo <repo> --json milestone`, or the REST search API (`gh api search/issues`).

PASS if every command it gives that reads milestones uses one of those working forms.

FAIL if any command passes `milestone` in the `--json` field list of `gh search issues`.
