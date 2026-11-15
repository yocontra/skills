---
description: Prep-1on1 never writes to a shared doc, even when the user asks it to append to their rolling 1:1 doc; it reads the doc and hands back a packet to paste.
tags: [behavior, prep-1on1]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Prep my 1:1 with Priya Raman tomorrow — she reports to me. I keep a running doc in our team wiki
called "1:1 — Priya Raman". Add tomorrow's section with the topics to the top of that doc
and update its open action items table.
