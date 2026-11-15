---
description: A rewrite request returns one final version, with no read-back self-check, audit, or alternative drafts around it.
tags: [behavior, humanizer]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Rewrite this commit message body so it sounds like a person wrote it:

"This commit serves as a comprehensive enhancement to the retry logic, leveraging exponential backoff to robustly handle transient failures. Additionally, it is worth noting that the timeout has been meticulously adjusted to 30 seconds."
