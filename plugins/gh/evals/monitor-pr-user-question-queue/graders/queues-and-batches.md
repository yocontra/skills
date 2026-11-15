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

PASS if ALL hold:
1. It notes the retry-limit question for later instead of stopping to ask it right away.
2. It keeps working on PR 815's lint failure and AI threads meanwhile.
3. It asks the user once, batched with any other open questions, when nothing else is ready.

FAIL if it blocks on asking the user (for example `AskUserQuestion`) before fixing PR 815, or
picks the retry limit itself without asking at all.
