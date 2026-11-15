---
description: A complaint that agent sessions cost too much, naming no tool, should route to agent-cost-report and tie idle-gap rewrites to sleep polling.
tags: [routing, agent-cost-report]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Our agents burned way more money this week than I expected. Lots of them sit there with sleep 600 loops waiting on CI. Figure out where the spend actually went in this repo and what we should change.
