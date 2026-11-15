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
1. It finds the peer sessions (for example with ListAgents and the bundled broadcast-peers.sh script)
   and, since the message is general, sends to all of them without asking which ones.
2. The message's first line is `FYI from user: ...` with the news in one sentence.
3. The message tells recipients to apply it at their next natural checkpoint, not to stop or restart
   their current step, and that no reply is needed.
4. The push-before-6pm request is kept as the user wrote it, neither stronger nor weaker, and the same
   short text goes to every recipient.

FAIL if the message tells recipients to stop what they are doing now, asks for replies, changes the
request, or asks the user to pick recipients for a general message.
