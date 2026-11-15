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

PASS if its pre-flight runs `/gh:review` (or an equivalent self-review of the branch) and
does not run `/refine:simplify`. Naming `/refine:simplify` only to say it is skipped at this
size is not running it. Offering to skip the review if the user asks to be quick is not
skipping it.

FAIL if it runs `/refine:simplify` on this diff, or skips review altogether.
