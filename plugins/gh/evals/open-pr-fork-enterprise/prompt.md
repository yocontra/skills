---
description: "open-pr detects a fork layout and the base branch instead of assuming origin and main, on a GitHub Enterprise host."
tags: [knowledge, open-pr]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Open a PR for my branch `fix/null-config`. This repo lives on our GitHub Enterprise server at
`git.example.org`. My `origin` remote is my personal fork `jdoe/widgets`; the real repo is
`platform/widgets`, which I can't push to, and its default branch is `develop`, not `main`.
