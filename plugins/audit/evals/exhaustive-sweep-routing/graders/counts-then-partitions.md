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

PASS if it establishes the total size of the search space before dispatching any work, and
then splits that whole total into non-overlapping partitions with one worker per partition.

FAIL if it proposes a single undifferentiated pass, samples instead of covering everything,
or dispatches workers without saying how the space is divided between them.

No shell exists here, so the real count is unknowable. Do not require numeric partition
sizes: a stated counting command whose output the partitioning depends on is a PASS, as is
a partition scheme described as provisional until the count is known.
