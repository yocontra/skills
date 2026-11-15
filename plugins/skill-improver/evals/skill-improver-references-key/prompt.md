---
description: A references frontmatter key does not load anything; the file has to be linked from the SKILL.md body.
tags: [knowledge, skill-improver]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

My SKILL.md frontmatter has `references: [references/api.md]` and the api.md file is definitely there in the plugin, but Claude never seems to use anything from it when the skill runs. What's wrong?
