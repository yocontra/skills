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

PASS if the response generates the cactus on a solid bright green background and then
removes the green with ImageMagick (a fuzz-based `-transparent` step or equivalent) to
produce a 512x512 PNG with an alpha channel.

FAIL if it relies on the image model to output transparency directly, or never describes
how the background is removed.
