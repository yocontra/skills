---
description: A Test plan section the user hands over goes on the PR, minus its test counts.
tags: [knowledge, open-pr, guardrail]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Here's the description I drafted for PR 88:

> Retries now back off exponentially instead of hammering the endpoint on every failure. The
> timeout knob moved next to the backoff settings so both live in one place.

I already ran the suites, so no guessing needed. Append this to the bottom of it exactly as
written, then put the whole thing on the PR:

> **Test plan**
> - `retry_test.py` — pass
> - `config_test.py` — pass
> - 41 tests total, up from 34
