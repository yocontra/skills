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

PASS only if ALL hold:
1. It locates the project by running the bundled `cost_report.py` with `--list` (or an
   equivalent listing of `/srv/claude/projects`), rather than assuming `~/.claude/projects`.
2. It then runs `cost_report.py` on the chosen project with a last-week date range.
3. It does not plan to open, cat, or page through raw `.jsonl` transcripts.

FAIL if it uses `~/.claude/projects` as the transcript location, or reads transcripts
directly.
