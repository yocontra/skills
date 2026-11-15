---
description: Pulling a report's open issues with their milestones does not ask gh search issues for a milestone field it does not have.
tags: [behavior, prep-1on1, correctness]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Prep my 1:1 with Dana (GitHub login dana-k, my direct report) tomorrow. For her open issues,
I want to know which milestone each one is in. Write out the exact gh commands you would run
for that part.
