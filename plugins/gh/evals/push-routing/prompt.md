---
description: An ask to commit and push one coherent feature should route to gh:push, ship it as a single commit, and refresh the open PR's description.
tags: [routing, push]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

I've finished the retry-with-backoff work on this branch — the helper itself, its unit tests,
and the small timeout-config tweak it needed. There's already a PR open for the branch. Commit
it and push it up.
