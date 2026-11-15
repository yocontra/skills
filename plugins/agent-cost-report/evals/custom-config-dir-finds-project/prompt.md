---
description: On a Linux box with a custom CLAUDE_CONFIG_DIR and no known project path, the skill finds the project with --list instead of guessing a path or reading raw transcripts.
tags: [knowledge, agent-cost-report]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

I'm on our shared Linux build host, where we run Claude Code with
`CLAUDE_CONFIG_DIR=/srv/claude`. Some project on here burned a lot of tokens last week but
I don't remember which checkout it was. Figure out which one and why it was expensive.
