---
description: "Toggle the refine auto-nudge hook. Args: auto | off | status. When auto, nudges to run /refine:simplify after each Edit/Write."
argument-hint: auto | off | status
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Run `node "${CLAUDE_PLUGIN_ROOT}/hooks/refine-mode.js" $ARGUMENTS`, report its output line, and continue.
