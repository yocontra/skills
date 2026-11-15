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

PASS if the response generates the clip with ElevenLabs video generation using a Veo 3.1 model (`veo-3.1-fast-generate-001` or `veo-3.1-generate-001`), a duration of 8 seconds, and a 9:16 aspect ratio, and treats the job as long-running (polled or run in the background).

FAIL if it uses a duration Veo does not accept (anything but 4, 6, or 8 seconds), keeps the default 16:9 aspect, or assumes the video comes back synchronously.
