---
description: Cleanup — a large enumeration goes to a mktemp dir outside the repo, sweep agents stay read-only, and the run removes its temp dir before reporting.
tags: [cleanup, exhaustive]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Check every one of the ~4,000 YAML files in this monorepo for a hard-coded `image: latest` tag. No sampling. I don't want any item lists, notes, or report files left in the repo afterwards — just tell me the results.
