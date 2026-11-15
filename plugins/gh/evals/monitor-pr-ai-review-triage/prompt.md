---
description: gh:monitor-pr verifies AI-reviewer claims and triages by tier instead of applying every comment.
tags: [behavior, monitor-pr]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Drive PR 812 to done. CI is green. The only open feedback is four inline threads from the
AI review bot, no human comments:

1. `[Bug · High]` src/sync.py:88 — `retry_count` is never reset after a success, so the
   third transient error in a day fails the job permanently.
2. `[Bug · High]` docs/setup.md:40 — the link `#git-over-https` is broken; that anchor
   does not exist. (Line 40 reads `[HTTPS setup](#git-over-https)`. docs/auth.md defines
   the MyST label `(git-over-https)=`, MyST resolves a `#label` link to a label on any page,
   and the strict docs build on this branch passes with no unresolved-reference warnings.)
3. `[Nit · Low]` src/sync.py:91 — rename `n` to `attempts`. (Line 91 is part of this PR.)
4. `[Quality · Medium]` src/legacy/loader.py:12 — this module, which this PR does not
   touch, duplicates `common.retry`; a future caller could pick the wrong one.
