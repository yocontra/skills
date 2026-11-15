---
description: After a debugging session the skill stops its background log stream and clears the simulator overrides it set.
tags: [cleanup, ios-debugging]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

On the simulator, set the location to Lisbon, override the status bar to 9:41 for clean shots, stream our app Driftly's logs while you open driftly://map, and capture a screenshot of the map. Walk me through the whole session start to finish, including how the simulator should be left afterwards.
