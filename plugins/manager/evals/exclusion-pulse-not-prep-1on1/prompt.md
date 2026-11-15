---
description: A mention of 1:1s must not pull prep-1on1 when the ask is the week's team state; team-pulse owns it.
tags: [exclusion, team-pulse, prep-1on1]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

I've got 1:1s stacked up all afternoon, but right now what I need is the state of the
team's projects this week — what's moving, what's stuck, anything burning.
