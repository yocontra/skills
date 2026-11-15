---
type: llm
---
This environment has no shell and its working directory is empty scaffolding, so no
response can run commands, read the real project, or report real results here. Do not
fail a response for not executing, for declining to invent results, or for offering to
finish against the real project; ignore any preamble about missing tools or files, which
is an artifact of the sandbox, not the behavior under test. Grade only the process the
response describes.

The response gives usable commit-message advice: a short imperative subject line that says what
changed, and a body that explains why the change was made rather than restating the diff.

PASS if that is the substance of the answer. FAIL if the advice is wrong, or if the answer is
buried under unrelated standup or weekly-status reporting material the question did not ask
for.
