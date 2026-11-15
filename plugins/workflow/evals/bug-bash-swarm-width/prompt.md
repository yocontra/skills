---
description: "Bug bash starts every ready fix unit at once up to the 20-subagent session limit, and fixers open the PR as soon as it passes."
tags: [knowledge, bug-bash]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Bug bash triage is done and the fix plan is approved: 32 reproduced issues, in 30 fix units. Two units
share a file, so they form one chain; the other 28 share nothing. I did not pass --parallel, and no other agents are running.
How many fixers do you start now, what happens to the rest, and what does each fixer do when its tests pass?
