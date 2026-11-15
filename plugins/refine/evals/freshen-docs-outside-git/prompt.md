---
description: Outside a git repo, freshen-docs cannot rely on a diff to undo edits, so it backs each file up before its first edit and then applies the fixes without waiting for approval.
tags: [generality, cleanup, freshen-docs]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

The docs and comments in ./handbook and ./scripts are out of date with what the scripts
actually do now. Fix them up. Heads up: this folder is just files on disk, it is not a git repo.
