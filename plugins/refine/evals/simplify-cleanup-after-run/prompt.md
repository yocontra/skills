---
description: A simplify run leaves only its intended edits — scratch copies go in a mktemp dir that is removed at the end, and nothing is stashed, committed, or left behind.
tags: [cleanup, simplify]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Simplify the changes I just made (about 200 changed lines over 6 files, nothing committed). I
have other uncommitted work in this tree that I care about. When you are done I want the tree
to hold your edits and nothing else, so tell me exactly what you will create along the way and
how you get rid of it.
