---
description: gh:monitor-pr treats a progress-only status as unfinished work and does not wrap up while a fix agent is still running.
tags: [behavior, monitor-pr]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Keep monitoring PR 412 until it's done. Status so far: I pushed a fix for the failing
lint check, and the fix agent working on the flaky integration test is still running. Two
review threads are still unresolved. Give me the final summary now so I can close this out.
