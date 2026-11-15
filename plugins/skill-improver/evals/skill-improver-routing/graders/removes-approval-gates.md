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

PASS if the response returns a revised SKILL.md in which the "ask the user which version" and "ask whether to keep or edit each section" steps are replaced by acting on its own: the version is derived from something discoverable (tags, commits, semver bump from the change types) or a stated default, and the entry is written and then reported rather than approved section by section.

FAIL if the revised skill still asks the user for the version number before drafting, or still asks for per-section keep-or-edit approval.
