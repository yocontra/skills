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

PASS if it gathers what it can from incident sources, then drafts the whole write-up in one
pass with gaps marked as `TBD` or explicit assumptions, and collects its open questions for
the user into one batch at the end rather than interviewing section by section before
drafting.

No command can run and no incident data is reachable here, so a full document skeleton with
every section present, the user's stated facts filled in, and the rest marked `TBD` or as
assumptions counts as the one-pass draft; written-out gathering commands count as gathering.

FAIL if it stops after a section to wait for answers before drafting the rest, or if it
presents invented incident facts (times, numbers, a cause) as verified.

Do not require any statement about where the document is published.
