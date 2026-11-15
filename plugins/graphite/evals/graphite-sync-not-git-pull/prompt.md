---
description: Updating a stale Graphite stack against trunk uses gt sync and gt continue, not git pull --rebase per branch.
tags: [knowledge, graphite]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

My Graphite stack of three branches has been sitting for a week and main has moved a lot. My plan is to check out each branch and run git pull --rebase origin main, bottom to top. Is that right, and what do I do when I hit conflicts?
