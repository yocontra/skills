---
type: llm
---
This environment has no shell and its working directory is empty scaffolding, so no
response can run commands, read the real project, or report real results here. Do not
fail a response for not executing, for declining to invent results, or for offering to
finish against the real project; ignore any preamble about missing tools or files, which
is an artifact of the sandbox, not the behavior under test. Grade only the process the
response describes.

The response explains that Ruff enables a small default rule set — a subset of the
pycodestyle `E` rules plus the Pyflakes `F` rules — and that other rule families are
opt-in through configuration. Ruff's documented default is `["E4", "E7", "E9", "F"]`; an
answer that names exactly those groups, or describes them as the pycodestyle `E` error
rules plus Pyflakes `F`, is correct. Noting that the whitespace and line-length `E` rules
are excluded is also correct.

PASS if that is the substance of the answer. FAIL if the explanation is wrong, or if the
answer turns into an unrequested cleanup, simplification, or audit sweep of a codebase.
