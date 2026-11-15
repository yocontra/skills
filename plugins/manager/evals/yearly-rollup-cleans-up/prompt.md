---
description: The yearly rollup keeps its scratch data and draft in a temp run dir, removes it at the end, stops its gather agents, and leaves nothing in the repo.
tags: [behavior, cleanup, yearly-rollup]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Write up what my team shipped this calendar year for my director. I'm running this from
inside one of our repos, so when you finish, list every file, temp directory, and helper
agent the process created and what happens to each.
