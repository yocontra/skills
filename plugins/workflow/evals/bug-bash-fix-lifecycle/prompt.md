---
description: "A reproduced bug gets a root-cause comment and a progress label when its fixer starts, and a Fixes #N PR; an already-fixed issue is closed with a comment, no approval step."
tags: [knowledge, bug-bash]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Bug bash triage is done. Issue #333 reproduced with a failing test and has a root cause.
Issue #444 was already fixed by a PR that merged last week. Walk me through exactly what bug bash does to each issue.
