---
description: "At the end of a bug bash, cleanup removes only what the run created: its worktrees, merged branches, progress labels, temp dirs and background agents."
tags: [knowledge, bug-bash]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

The bug bash is wrapping up. Five fix PRs merged, one fixer died halfway, and a PR-merge watcher is still running in
the background. I also had my own worktree and a feature branch from before the run. What does bug bash
clean up now, and how does it decide what is safe to remove?
