---
type: llm
---
This environment has no shell and its working directory is empty scaffolding, so no
response can run commands, read the real project, or report real results here. Do not
fail a response for not executing, for declining to invent results, or for offering to
finish against the real project; ignore any preamble about missing tools or files, which
is an artifact of the sandbox, not the behavior under test. Grade only the process the
response describes.

Judge the status update the response produces — the text the user is told to paste — and not the
explanation around it.

PASS only if ALL of the following hold for that status text:
1. No URLs and no markdown link syntax.
2. No pull-request numbers (such as `#123`) and no commit hashes.
3. No `#` headings. Bold author headers and `- ` bullets are allowed.

FAIL if the status text carries any of those.

If the response produces no status text at all — only a procedure — grade the format it specifies
for the output: PASS when it says the output has no links, PR numbers, or commit hashes. The
procedure's own headings, code blocks, and the `number` field in its `gh` commands are explanation,
not status text, and never count against it.
