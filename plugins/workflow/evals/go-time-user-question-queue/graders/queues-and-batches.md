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

PASS if ALL hold:
1. It picks a wording itself on a stated basis (the repo's existing messages, the plan, or a sensible
   default) and lists that choice as an assumption in its report, rather than asking the user.
2. Tasks 1 and 3 proceed without waiting on anything.
3. If it says it would ask at all, it reserves asking for a question whose answers would produce
   materially different work, queued so other work continues (for example a questions file in a run
   directory it later removes) and asked in one batch when nothing else is ready.

FAIL if it stops any work to ask the user which wording to use, or blocks tasks 1 and 3.
