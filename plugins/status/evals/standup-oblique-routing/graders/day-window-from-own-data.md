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

PASS if the update it builds is sourced from the user's own data — their git commits and pull
requests, and their calendar — so the content comes from those queries.

FAIL if it asks the user to tell it what they got done, or hands back a blank template with no
commands that would fill it in.

The environment has no shell, so the response can only write the gathering commands out instead of
running them; a template is fine as long as the response also gives the commands that fill it in.
