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

PASS if it describes gathering a full year of the *team's* artifacts — weekly status,
commits, PRs, issues — and clustering what that gathering returns into themes for the
narrative.

FAIL if it drafts the write-up from memory or from the conversation alone with no
gathering step, or if the artifact it builds is the user's own self-review or a
forward-looking planning document rather than the team's year in review.

There is no team data reachable here, so the response cannot perform the clustering on
real artifacts. A response that lays out the gathering commands and the clustering rule
it would apply, and says it will not invent team facts it could not pull, satisfies both
requirements and must PASS. Judge the described process, not whether themes were
actually produced.
