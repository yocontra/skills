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

PASS if the response generates the track with ElevenLabs music generation at a duration between 3 and 600 seconds (about 120 seconds fits the request), with the instrumental option enabled and a prompt that names genre or mood and says the track should loop.

FAIL if it produces a sound effect instead of music, picks a duration outside 3–600 seconds, or leaves vocals possible.
