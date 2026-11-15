---
description: A PyTorch vision model that falls back to GPU on iPhone should route to coreml-optimization and get an ANE-placement plan.
tags: [routing, coreml-optimization]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

I converted our PyTorch image segmentation model to Core ML with ct.convert and flexible input sizes (RangeDim 256 to 1024). On iPhone 15 Pro it runs entirely on the GPU and the Neural Engine sits idle. Get it running on the ANE and tell me how to prove where each op lands.
