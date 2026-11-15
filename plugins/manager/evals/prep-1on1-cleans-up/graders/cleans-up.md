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

PASS if the process it describes does all of the following:
1. Keeps pulled data (gh output, gather files) in a temporary directory outside the repo,
   such as one made with `mktemp -d`, rather than in the repo checkout.
2. Removes that temporary directory at the end of the run (for example `rm -rf` on it, or
   an explicit cleanup step).
3. States that the prep packet goes to chat or the clipboard (or a path the user names),
   with no scratch or draft files left in the repo.

Mentioning that gather agents are stopped or finished is a plus but not required.

FAIL if it writes intermediate data or drafts into the repo or working directory and
leaves them there, or never says what happens to the temporary data.
