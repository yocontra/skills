---
description: A draft flagged as machine-written, with no rewrite asked for by name, should still route here and name the actual habits.
tags: [routing, humanizer]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

A reviewer left one comment on my design doc: "reads like a bot wrote it." That's all I got.
Here is the opening paragraph. What am I supposed to change?

"In today's rapidly evolving landscape, observability stands as a pivotal capability for
modern engineering organizations. This document delves into a comprehensive framework that
not only surfaces latency regressions, but also fosters a culture of proactive remediation."
