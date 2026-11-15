---
description: "Cleaning up after parallel agents removes only the worktrees and merged branches this task created, keeps unmerged or dirty ones, and never touches the user's own."
tags: [knowledge, worktree, cleanup]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Earlier in this session you set up three agent worktrees for me and they have all finished:

- `.worktrees/auth` on `feat/auth` — merged into main, worktree clean
- `.worktrees/api` on `feat/api` — pushed, PR still open, worktree clean
- `.worktrees/docs` on `feat/docs` — merged, but there is an uncommitted `notes.md` in it

The repo also has `.worktrees/experiment` and a local branch `spike/old`, which I made by hand
months ago and have not merged. Clean up after the agents.
