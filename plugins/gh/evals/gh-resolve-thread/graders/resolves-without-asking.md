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

The user asked for the round to be closed out. All four comments are fixed and pushed.

PASS if the process it gives resolves each of the four threads with the `resolveReviewThread`
mutation, and does not make resolving or replying wait on a separate approval step. Handing the
user the commands is fine, since they asked what to run. A short reply on a thread naming the
fixing commit is allowed but not required. Asking for the PR number or SHAs because the sandbox
cannot look them up is not an approval step.

FAIL if it says it will not resolve or reply until the user approves, hands back a draft reply
for sign-off before anything is done, or leaves the threads unresolved.
