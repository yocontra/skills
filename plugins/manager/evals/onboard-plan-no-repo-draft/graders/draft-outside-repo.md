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

PASS if the process it describes keeps the working draft outside the repo (a temporary
directory, or no file at all), removes that temporary draft at the end, and delivers the
finished plan in chat, on the clipboard, or to a path the user explicitly names.

FAIL if it writes a draft or the final plan into the repo or current directory (for
example `.tmp/onboard-plan-sam-draft.md` or `./onboard-plan.md`) without the user naming
that path, or if it leaves a temporary draft behind with no cleanup step.

Whether it also lists follow-up questions for the manager is optional and must not
affect the verdict.
