---
description: Simplifying a small uncommitted diff should use one simplifier for every file, and the behavior reviewer must restore from pre-edit copies so the user's uncommitted work survives a revert.
tags: [knowledge, simplify]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Simplify what I just changed. Nothing is committed yet: `git diff --shortstat` says 3 files
changed, 41 insertions(+), 12 deletions(-). Walk me through how you will run it, how many
agents, and how a bad edit gets undone without losing my uncommitted changes.
