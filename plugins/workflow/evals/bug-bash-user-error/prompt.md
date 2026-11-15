---
description: "User errors split by whether the docs cover them: a reply and a close, or a docs fix, with no approval step."
tags: [knowledge, bug-bash]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Bug bash triage came back with two user errors. Issue #111: the user passed the wrong flag, and the
CLI docs already explain the right one. Issue #222: same kind of mistake, but nothing in the docs
covers it. How does bug bash handle each one?
