---
description: Mid-setup, a plan the user drops has its just-created change removed, and only that one; changes that existed before setup stay.
tags: [setup, cleanup]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Run /openspec:setup for this repo. It already had openspec/changes/rate-limits before today. Partway through converting docs/plans/, you ran openspec new change legacy-auth for docs/plans/legacy-auth.md, and now I've decided legacy-auth isn't a plan worth keeping. Drop it and finish the setup.
