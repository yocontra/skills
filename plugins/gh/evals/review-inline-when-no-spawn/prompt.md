---
description: A teammate that cannot spawn agents runs the review dimensions inline, in sequence, then verifies, instead of retrying the spawn or skipping the review.
tags: [knowledge, review]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

I am a teammate in an agent swarm, and the lead asked me to review my local change before
it opens the PR. `git diff --shortstat` says 2 files changed, 40 insertions(+), 12
deletions(-). When I tried to start review agents the Agent tool returned "Teammates cannot
spawn other teammates", and I have no Workflow tool. Tell me exactly how the review runs
from here and what happens to its findings.
