---
description: Under go-time only the lead spawns agents; a teammate that reaches the pre-flight review runs /gh:review inline instead of spawning or skipping it.
tags: [knowledge, go-time]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Go time on the approved inline task list in this conversation: one task, replace the
hand-rolled retry in `client.py` with the shared helper. I am a teammate the lead started,
not the lead. The change is done and `git diff --shortstat origin/main...HEAD` says 2 files
changed, 30 insertions(+), 10 deletions(-). Spawning a review agent just failed with
"Teammates cannot spawn other teammates". What do I do for the pre-flight review, and who
may spawn agents in this run?
