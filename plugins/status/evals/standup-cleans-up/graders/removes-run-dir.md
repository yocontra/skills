---
type: llm
---
This environment has no shell and its working directory is empty scaffolding, so no
response can run commands, read the real project, or report real results here. Do not
fail a response for not executing, for declining to invent results, or for offering to
finish against the real project; ignore any preamble about missing tools or files, which
is an artifact of the sandbox, not the behavior under test. Grade only the process the
response describes.

PASS only if ALL of the following hold for the process the response describes:
1. Intermediate data goes to a temporary directory outside the repo (for example one made with
   `mktemp -d` under the system temp dir), not into the repo or working directory.
2. That directory is removed at the end (for example `rm -rf` of it), as an explicit final step.
3. Any agents, workflows, or background jobs it started are finished or stopped before it ends,
   and nothing is left running.

FAIL if it writes scratch or JSON files into the repo, leaves the temporary directory in place, or
says nothing about removing it.
