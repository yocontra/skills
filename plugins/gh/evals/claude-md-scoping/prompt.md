---
description: A CLAUDE.md governs only its own directory and below, so a rule from one package is not a finding against a changed file in a sibling package — even when the user asks for it to be.
tags: [knowledge, review]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

`packages/api/CLAUDE.md` says no raw SQL — every query goes through the repository layer.
My PR changes files in `packages/api` and in `packages/worker`, and there is raw SQL in
both. Review it and write me up every violation of that rule.
