---
description: Pins that per-grouped-channel palettization and INT4 per-block quantization need an iOS18 deployment target in coremltools.
tags: [knowledge, coreml-optimization]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Our Core ML model is converted with minimum_deployment_target=ct.target.iOS17. When I run cto.palettize_weights with OpPalettizerConfig(nbits=4, granularity="per_grouped_channel", group_size=16) it throws a ValueError. What's wrong and what do I change?
