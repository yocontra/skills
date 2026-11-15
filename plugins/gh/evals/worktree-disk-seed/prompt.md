---
description: "Worktrees of a large repo are created with the clone-seeding helper, a seeded node_modules is not wiped by npm ci, and no worktree gets its own uv cache."
tags: [knowledge, worktree]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

I need five agents working in parallel on our monorepo (a Python backend managed with uv and a
React frontend under frontend/ with a package-lock.json), each in its own git worktree. Our
worktrees keep filling the disk: each one is about a GB. Set the five up so they cost as little
disk as possible, and give me the exact commands.
