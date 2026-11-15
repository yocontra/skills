---
description: gh:review classifies findings into Bug / Quality / Nit tiers and keeps nits out of inline threads.
tags: [behavior, review]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Review PR 941 before I merge it. I care about real bugs, but I also want tight code — type
holes, needless complexity and sloppy docs matter to me, so don't drop those. I just don't
want twenty threads about phrasing. How will the findings be classified and posted?
