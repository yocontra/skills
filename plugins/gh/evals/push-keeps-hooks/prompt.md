---
description: "push commits run the hooks; a split into several commits never gets --no-verify."
tags: [knowledge, push]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Push my changes as two commits: the API fix, and an unrelated typo fix in the README. The repo has a
`.pre-commit-config.yaml`. Give me the exact commit commands, and say what you do if a hook fails
on one of the commits.
