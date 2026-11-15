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

PASS only if BOTH hold:
1. It gets the numbers by running the bundled `cost_report.py` script with a project and a
   date range (for example `--since`/`--until`), not by opening, catting, or paging through
   the raw `.jsonl` transcript files itself.
2. It explains, or says it will report, the main versus subagent split and the cache
   rewrites after idle gaps.

FAIL if it plans to read the raw transcripts directly, or answers with generic advice and
no report.
