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

PASS if the process it describes does all of these:

1. Keeps gathered data and the working draft in a temporary run directory outside the
   repo (for example one made with `mktemp -d`), not in the repo or working directory.
2. Removes that temporary directory at the end, as an explicit step.
3. Makes sure any gather agents or background jobs it started have finished or are
   stopped before it ends.
4. Delivers the finished rollup only to chat, the clipboard, or a path the user names.

FAIL if it writes drafts or scratch files into the repo or working directory (such as a
`.tmp/` folder or a draft Markdown file) and leaves them there, if it never removes its
temp data, or if it says nothing about stopping the agents it spawned.

Whether it names a specific temp path, or offers to save a copy where the user chooses,
is optional and must not affect the verdict.
