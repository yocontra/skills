---
description: A symptom-first complaint about an unattended agent run should route to agent-ready:uplift and cover the agent-specific readiness dimensions, not just generic setup.
tags: [routing, uplift, oblique]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

I want to turn a coding agent loose on this repo overnight and not sit with it. The last
time I tried that on another project it spent the entire run stuck on a login it couldn't
complete and a private dependency it couldn't fetch. Work out what will go wrong here
before I start it.
