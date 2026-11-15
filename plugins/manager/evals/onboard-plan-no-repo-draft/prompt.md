---
description: The onboarding plan's working draft lives in a temp dir that is removed at the end; the plan is delivered to chat and clipboard, not written into the repo.
tags: [behavior, cleanup, onboard-plan]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Sam joins my team in two weeks; help me build a 30/60/90 ramp plan for him. I'm in our
service repo right now and I don't want stray files in it, so tell me where every file
you write goes and what is left when you are done.
