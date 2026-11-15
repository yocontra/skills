---
description: Cleanup — a --fix run snapshots the tree first, detects the repo's own checks, and leaves only the intended edits and no temp dir behind.
tags: [cleanup, bugs]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Run /audit:bugs --fix on the billing module. Last time a tool like this left scratch files and a stray branch in my checkout, so tell me exactly how you make sure only the actual fixes are left when you're done.
