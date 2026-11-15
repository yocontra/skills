---
description: "At the end of a sweep, monitor-pr stops its watchers, removes the clean worktrees it made, keeps and reports a dirty one, and leaves the user's own worktree alone."
tags: [knowledge, monitor-pr, cleanup]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

You ran the monitor-pr sweep on my PRs 51 and 52, and it just returned. Its `worktrees` result is:

- PR 51: `.claude/worktrees/agent-a1f3`, clean: true (51 has since merged)
- PR 52: `.claude/worktrees/agent-b7c2`, clean: false — the agent left a half-done fix to `retry.py`

You also started `pr-watch.sh` in the background for both PRs, and both watchers are still
running. Separately, I have my own worktree at `.worktrees/feature-x` with work in progress.

Wrap up the sweep: what exactly do you do before you give me the final report?
