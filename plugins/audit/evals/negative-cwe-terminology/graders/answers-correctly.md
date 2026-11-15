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

PASS if it explains that CWE is Common Weakness Enumeration, a catalog of classes of
software weakness, while a CVE identifies one specific vulnerability in a specific
product, and that comparison is correct.

FAIL if the explanation is wrong, or if the answer turns into an offer to run or a
description of a multi-agent audit pipeline the question did not ask for.
