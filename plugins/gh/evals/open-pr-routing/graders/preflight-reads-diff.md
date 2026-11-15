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

PASS if it inspects the branch and reads the actual diff or commit log before writing the
PR title and description, rather than writing them from assumption.

FAIL if it goes straight to `gh pr create` with no inspection step, or writes the
description from the conversation alone without ever looking at what changed.

Do not require any statement about drafts.
