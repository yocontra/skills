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

PASS if the response traces a generated high-contrast render into vector paths (threshold, potrace, svgo or equivalent) and makes the result recolorable with `currentColor` or an equivalent fill that CSS can set.

FAIL if the deliverable is a raster PNG, or the SVG keeps hard-coded fill colors with no way to recolor it from CSS.
