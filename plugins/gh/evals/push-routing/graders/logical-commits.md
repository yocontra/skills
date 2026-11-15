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

The three pieces described — a helper, its unit tests, and the config tweak the helper needed —
are one coherent unit of work.

PASS if they go into a single commit.

FAIL if the work is split into a separate commit per piece (feature / tests / config), or into
any arrangement of more than one commit.

Ignore everything else the response does — how it stages, whether it presents a summary, and
what it does about the PR are other graders' business.
