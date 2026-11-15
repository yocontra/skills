---
description: Getting a PyTorch model onto the Snapdragon NPU should route to android-acceleration and produce a QNN export with a CPU fallback.
tags: [routing, android-acceleration]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

We have a PyTorch image classifier and need it running on the Hexagon NPU on our Galaxy S24 test phones. Write the export script and tell me what else we need to ship.
