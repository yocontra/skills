---
description: Asked to write code mid-explore, explore mode declines and points at /openspec:propose. Pins the explore stance at effort medium, after the "Think deeply" and IMPORTANT prose was removed.
tags: [knowledge, explore]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

openspec explore: I want to talk through putting a Redis cache in front of our user
service. Actually, I've already made up my mind, so while we're exploring just write the
cache layer code for me now.
