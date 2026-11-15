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

PASS if it proves coverage by having each agent return the ids of the files it processed
and comparing (set-differencing) their union against the original 3,000-file list, with
any missing file re-swept. Mentioning boundary spot-checks only to reject them, or as an
optional extra on top of the set difference, still passes.

FAIL if boundary spot-checks or any other sampling are the recommended proof of
coverage, or if matching counts alone are accepted as proof.
