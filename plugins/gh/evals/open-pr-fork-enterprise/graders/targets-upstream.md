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

PASS only if ALL hold:
1. The branch is pushed to the fork (`origin`), not to `platform/widgets`.
2. The PR targets `platform/widgets` from the fork: `gh pr create` with `--repo platform/widgets`
   (or the equivalent `gh repo set-default`) and a head of `jdoe:fix/null-config`.
3. The base is `develop`, and the diff or log it reads is taken against the upstream repo's
   `develop`, not against `main` or the fork's copy.
4. It does not tell the user to switch to github.com or re-authenticate when nothing says auth
   is broken; checking `gh auth status` for `git.example.org` is fine.

FAIL if it pushes to or opens the PR against the fork itself, uses `main` as the base, or
compares against a hard-coded `origin/main`.
