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

A dozen PRs is a fleet, and most of the spend is one agent per PR.

PASS if BOTH hold:
1. PRs that are already green with no unresolved review feedback are left out of the sweep,
   rather than every matched PR being tended.
2. It sizes the fleet and reports what it found — PR count, how much is actually wrong —
   before spending on the per-PR agents.

FAIL if it plans to touch all twelve regardless of whether they need anything, or launches
straight into the fix wave with no sizing step.
