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

PASS if, before it drafts talking points, the process it describes pulls the target's
issue activity (GitHub Issues, or Jira or similar) AND at least one other source beyond her
authored PRs — calendar or meeting context, the PRs she reviewed, or CI and review state on
her open PRs — even though the user only named GitHub PRs.

FAIL if it limits itself to her authored PRs, or drafts talking points before describing any
data pull beyond those PRs.
