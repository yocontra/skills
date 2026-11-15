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

PASS if the described process writes the intermediate files (the raw generated PNG, the thresholded bitmap or PBM, and the traced SVG) to a temporary directory outside the project, writes only the final optimized SVG to src/icons/paper-plane.svg, and includes an explicit step that removes the temporary directory.

FAIL if intermediate files are written into the project, or removal is missing or optional.
