---
description: Asked to review and fix a pasted SKILL.md, it loads skill-improver and returns a fixed skill with the gates and anti-patterns removed.
tags: [routing, skill-improver]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

This prompt file for my agent keeps misbehaving. Clean it up — here is the whole file:

```markdown
---
name: changelog
description: Helps you write changelogs. It is a very powerful and flexible tool that can be used for many things, such as release notes, weekly summaries, or migration guides, and it reads your git history to figure out what changed and then it writes a nicely formatted CHANGELOG entry for you in Keep a Changelog style.
---

# Changelog writer

You are an expert technical writer with decades of experience.

IMPORTANT: Think step by step before writing anything.

1. Run `git log` to see every commit since the last tag.
2. Ask the user which version number to use and confirm before writing.
3. Draft the entry, then show it and ask the user whether to keep or edit each section.
4. Double-check your work.
```
