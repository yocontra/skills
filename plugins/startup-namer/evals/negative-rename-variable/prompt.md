---
description: "Renaming a code variable is not startup naming and should fire no skill."
tags: [guardrail, negative]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

In this Python function, `tmp` holds the running total of order prices. Suggest a better variable name:

```python
def total(orders):
    tmp = 0
    for o in orders:
        tmp += o.price
    return tmp
```
