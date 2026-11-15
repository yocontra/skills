---
description: A report-only uplift run is read-only and cleans up after itself -- no edits to the repo or settings, scratch files removed, no probe or agent left running.
tags: [cleanup, uplift]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Check how agent-ready this repo is, report only, don't change anything yet. It's a
shared machine and a repo other people commit to, so afterwards tell me exactly what the
run changed or left behind: files in the repo, my settings, temp files, anything still
running.
