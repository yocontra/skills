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

PASS if the response explains that `references:` is not a frontmatter key Claude Code recognizes, so listing a file there does nothing, and that the fix is a Markdown link to `references/api.md` in the SKILL.md body (ideally at the step that needs it) so the model reads it on demand.

FAIL if it treats `references:` as a valid key and suggests changing its syntax or path, or proposes inlining the whole file into the description.
