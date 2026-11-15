---
description: A fleet of red PRs should route to gh:monitor-pr's multi-PR sweep, skip the ones with nothing to do, treat a long-stale PENDING check as stuck rather than running, and check labels before arming auto-merge.
tags: [routing, monitor-pr]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

I've got about a dozen open pull requests and most of them are red. A couple of them have
been sitting on a pending check since yesterday morning. Work through them, and queue
whatever comes out clean so it merges on its own.
