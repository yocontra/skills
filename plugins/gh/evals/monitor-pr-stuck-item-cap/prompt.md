---
description: gh:monitor-pr stops retrying one item after a few rounds with no change and reports it as stuck.
tags: [behavior, monitor-pr]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Keep watching PR 530. Heads up: the unit-tests check on it has failed three rounds in a row
with the same assertion error, even after each of your fixes was pushed. Everything else on
the PR is green and there are no open review threads. Carry on.
