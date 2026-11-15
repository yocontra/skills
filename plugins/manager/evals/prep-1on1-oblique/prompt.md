---
description: An imminent conversation with one named person should route to prep-1on1 and resolve that person's direction from the team roster, defaulting to peer rather than asking.
tags: [routing, prep-1on1]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

I'm sitting down with Dana in forty minutes and I have no idea what she's been working on
since we last talked. Get me something I can walk in with.
