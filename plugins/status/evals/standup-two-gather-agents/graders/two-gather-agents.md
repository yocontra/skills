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

PASS if the data-gathering step it describes uses two gather agents (for example one for
git and PRs, one for issues and the calendar), with identity and repo detection such as git
user.name, user.email or the repo path done by the main agent itself or not mentioned.

FAIL if it spawns a third or separate agent whose job is identity, git config, time, or
repo detection, or describes three gather agents in total.
