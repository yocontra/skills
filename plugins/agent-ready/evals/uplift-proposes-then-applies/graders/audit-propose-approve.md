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
1. It audits the repo before changing anything (tools, auth, permissions, existing
   CLAUDE.md or AGENTS.md, dev-loop commands, or similar).
2. It plans concrete changes drawn from the audit, such as a CLAUDE.md or AGENTS.md,
   `.claude/settings.json` permission rules for the repo's own commands, format or lint
   hooks, MCP config, test/lint/build commands, setup docs, or `.gitignore` entries.
3. It goes from the plan straight to applying the changes itself (or says it will), with no step
   that asks the user to approve the plan first, and it reports what changed. An offer of an
   opt-in report-only mode is fine. A closing note about running in the real repo, or about the
   sandbox (for example "run this in the real repo" or "share the path"), is an environment
   artifact, not an approval gate. This criterion fails only if the response stops to ask
   permission before applying.
4. It merges into existing files rather than replacing what the project wrote. Listing installs,
   logins and other machine-state commands for the user to run is expected, not a gap.

FAIL if it stops to ask the user's permission to apply the plan, writes files before the audit, says it
will replace or delete existing project content, or adds a blanket permission such as `Bash(*)` or
`bypassPermissions`.
