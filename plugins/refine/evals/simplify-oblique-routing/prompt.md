---
description: A symptom-first complaint about messy just-written code should route to refine:simplify and stay inside the working-tree diff.
tags: [routing, simplify]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

The feature works and the tests are green, but what I wrote this morning is a mess — I'm
fairly sure I rebuilt a helper we already have, and there's a loop in there doing two passes
where one would do. Take another run at it before I push.
