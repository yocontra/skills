---
description: "After go-time merges a PR it stops its watchers, removes its worktree and merged branch, and deletes its temp files, without touching anything it did not create."
tags: [knowledge, go-time]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Go time run on issue #77: the PR just merged (squash merge). The run made a worktree and a branch `fix/77-timeout`,
wrote the PR body to a temp file, and started a background `pr-watch.sh` checks watcher. What is left to do before the run is done?
