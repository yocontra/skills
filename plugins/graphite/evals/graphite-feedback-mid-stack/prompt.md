---
description: Review feedback on a mid-stack branch is fixed with gt modify, threads resolved over GraphQL silently, and the stack restacked and resubmitted.
tags: [behavior, graphite]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Reviewers left a handful of inline comments on the second PR of my four-PR Graphite stack (I'm on the top branch right now). Work through the feedback, then get every PR in the stack updated and the threads cleaned up.
