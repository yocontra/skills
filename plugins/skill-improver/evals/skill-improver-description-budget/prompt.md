---
description: A 900-char description is not fine just because it is under the 1024 hard limit; it is billed every session and should be routing metadata.
tags: [knowledge, skill-improver]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

My skill's description is about 900 characters. It lists every use case with an example and a couple of rules about output format. That's under the 1024 limit, so it's fine to ship as is, right?
