---
description: "Recovery: with the rea MCP tools missing, the skill diagnoses with rea-agents doctor, shows a setup dry-run before any config write, and otherwise falls back to the manual toolchain instead of silently skipping REA."
tags: [behavior, recovery, reverse]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Find memory-safety bugs in /opt/vendor/bin/licensed. It's a stripped x86-64 ELF license daemon and we have no source. Heads up: the rea tools aren't showing up in my session today.
