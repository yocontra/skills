---
description: Done means — a sweep with waves still to run is not finished, and the time budget never justifies dropping items.
tags: [knowledge, loop-completion]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

We're running /audit:exhaustive over 3,000 config files. Waves 1 and 2 have reported, waves 3 and
4 haven't started, and we're already past the time budget you estimated. Can we write up
the findings from the first two waves and call the sweep done?
