---
description: "Knowledge: detect a Graphite-initialized repo by its config file, not by running gt trunk, which initializes an uninitialized repo."
tags: [knowledge, graphite]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

I'm writing a pre-flight step for an agent script that runs across many of our repos. It needs to tell whether a repo already uses Graphite before it decides between gt and plain gh, and it must not change anything in repos that don't use Graphite. My draft runs `gt trunk` and treats a non-zero exit as "not a Graphite repo". Is that right? Give me the check to use.
