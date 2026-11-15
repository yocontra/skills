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
1. `api-fix` receives the message, because its recent PRs include payments-api#412 (the strongest signal).
2. `docs-pass` does not receive it.
3. `reviewer` (same repo, different PR) is left out as a guess, and the report says so (an offer to
   add it is fine).
4. It does not ask the user to pick or confirm the recipients first, since `api-fix` is a clear match.
   Where `SendMessage` is not available in this sandbox, stating the send it makes (recipient and
   text) counts as sending.
5. The message starts with `FYI from user:` and keeps the rebase request as written.

FAIL if it sends to all three sessions, skips `api-fix`, or asks the user to pick or confirm the
recipients before it will send.
