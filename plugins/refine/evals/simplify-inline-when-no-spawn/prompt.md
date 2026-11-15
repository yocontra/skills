---
description: A forked worker that cannot spawn agents runs the simplifier and then the behavior-preservation review inline, against snapshots, instead of retrying the spawn or skipping the review.
tags: [knowledge, simplify]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Simplify what I just changed. I am a forked worker: the Agent tool told me "Fork is not
available inside a forked worker", and there is no Workflow tool here. Nothing is committed
yet; `git diff --shortstat` says 4 files changed, 160 insertions(+), 30 deletions(-). Walk
me through how the simplify runs from here and how a bad edit gets undone without losing
my uncommitted changes.
