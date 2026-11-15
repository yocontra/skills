---
description: Pins the joint compression rules — per_tensor INT8 linear quant on a palettized model, joint_compression=True, A17 Pro / M4 datapath.
tags: [knowledge, coreml-optimization]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

We already palettize our Core ML LLM to 4-bit with coremltools. Someone said newer iPhones can run it faster if we also do "joint compression". What exactly do I run on top of the palettized model, with what settings, and which devices actually benefit?
