---
description: Done means — a forever-mode cleanup keeps cycling on a progress summary, and a batch that failed twice is reported, not retried again.
tags: [knowledge, loop-completion, code-cleanup]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

I'm running /refine:code-cleanup --forever on our repo. Cycle 3 just printed its summary:
FOUND 9, FIXED 5, REMAINING 4 — and one fix batch has now failed twice on the same two
issues. Cycle 3's findings are different from cycle 2's. Should the run stop here, and what
should happen to that failing batch?
