---
description: A 1:1 prep keeps its gather files in a temp run directory, removes it at the end, stops its gather agents, and leaves no scratch files in the repo.
tags: [behavior, prep-1on1, cleanup]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Prep my 1:1 with Sam Okafor tomorrow — he reports to me. I'm running this from inside our
main repo checkout. Walk me through the whole run, including where the data you pull is kept
while you work and what is left behind on my machine when you finish.
