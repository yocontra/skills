---
description: A pre-PR review of a small diff should run the dimensions as one or two combined agents, not seven, and still verify findings before showing them.
tags: [knowledge, review]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Review my local change before I open the PR. It is small: `git diff --shortstat` says
2 files changed, 68 insertions(+), 22 deletions(-). It swaps a hand-rolled retry loop in
`client.py` for our shared retry helper and updates the one test that covers it. Tell me
exactly how you will run the review: how many agents, what each covers, and what happens
to their findings.
