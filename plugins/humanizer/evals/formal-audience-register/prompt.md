---
description: Rewriting customer-facing docs for a formal, translated audience keeps the prose plain but drops slang and idioms instead of making it chatty.
tags: [knowledge, humanizer]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Please humanize this paragraph from our customer-facing admin guide. It gets machine
translated into nine languages, so keep that in mind.

"Leveraging our cutting-edge backup solution, administrators can effortlessly safeguard
mission-critical data. It's a total game-changer — just set it and forget it, and your
data will be in good hands moving forward."
