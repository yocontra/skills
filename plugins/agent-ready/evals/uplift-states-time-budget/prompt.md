---
description: A full uplift audit fans out one probe per requirement and should state an expected wall-clock before launching them.
tags: [behavior, uplift, budget]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

I'm about to run a full /agent-ready:uplift check on a service repo with about 30
requirements, fanned out to parallel probe agents. Before I start: how long should the run
take, and what should the probe agents be told about time while they work?
