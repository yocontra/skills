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
1. The rewrite drops the promotional wording ("cutting-edge," "mission-critical,"
   "game-changer," "effortlessly," "leveraging").
2. It drops idioms that translate poorly ("set it and forget it," "in good hands,"
   "moving forward") rather than swapping in new idioms or slang.
3. The result is plain, short sentences suited to formal documentation; it does not
   become chatty (no jokes, no exclamation marks, no first-person asides).

FAIL if any idiom or promotional phrase survives, or if the rewrite adds casual slang.
