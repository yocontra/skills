---
name: bugs
description: Check code for unknown bugs — logic errors, race conditions, edge cases — in one file, a module, or a whole codebase, via adversarial hunter, skeptic, and referee passes. For bug checks, bug sweeps, and correctness audits, not one known bug.
effort: high
---

$ARGUMENTS

# Bug audit

This skill hunts for bugs adversarially. Three roles with opposing goals keep the real bugs and remove the false positives:

| Role | Goal |
|---|---|
| **Hunter** | Report real bugs, each with a concrete trigger |
| **Skeptic** | Disprove each finding with evidence from the code; let it survive when there is none |
| **Referee** | Read the code independently and decide what goes into the report |

The shared conventions are in [agent-protocol.md](../../shared/agent-protocol.md): path choice, modes, fix-mode safeguards, cost knobs, findings format, and the exit checklist. The agent prompts are in [`workflows/bugs/prompts/`](../../workflows/bugs/prompts/): [recon](../../workflows/bugs/prompts/recon.md), [hunter](../../workflows/bugs/prompts/hunter.md), [dedup](../../workflows/bugs/prompts/dedup.md), [skeptic](../../workflows/bugs/prompts/skeptic.md), [referee](../../workflows/bugs/prompts/referee.md), and [fix](../../workflows/bugs/prompts/fix.md).

## What counts

- **Concrete triggers only.** Every finding names a specific input, sequence, or condition that causes the failure. "This could be a problem" is not a finding.
- **Read, don't grep.** A hunter reads each file in its zone and reasons about behavior. Pattern matching misses the interesting bugs.
- **No style nits.** This audit finds defects, not formatting preferences.
- **Honest skeptic, independent referee.** The skeptic cites code or lets the finding survive. The referee trusts neither side's account.

## Run

1. **Path.** Choose inline, workflow, or prose pipeline from [the table](../../shared/agent-protocol.md#choose-the-path). A target of 1-3 small files runs inline with no agents.
2. **Scope.** If the user named files or a module, collect them with `Glob` and set `scope.constrained: true`. If not, pass the project root and let recon enumerate.
3. **Mode.** The default mode is report-only. For `--fix` or `--forever`, do the [fix-mode safeguards](../../shared/agent-protocol.md#fix-mode-safeguards) first (detect checks, baseline).
4. **Budget and knobs.** State the budget, and set `args.effort` or `args.model` if needed ([Before launch](../../shared/agent-protocol.md#before-launch)).
5. **Launch** (workflow path). Read `${CLAUDE_PLUGIN_ROOT}/skills/bugs/audit.config.json`, merge in `scope` and the mode flags, and run:

   ```
   Workflow({
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/bugs/audit.js",
     args: { ...<merged config>, promptsDir: "${CLAUDE_PLUGIN_ROOT}/workflows/bugs/prompts" }
   })
   ```

   If `${CLAUDE_PLUGIN_ROOT}` does not expand inside `scriptPath`, resolve it with `echo "${CLAUDE_PLUGIN_ROOT}"` and pass the literal path. If the tool is missing or disabled, use the [prose pipeline](../../shared/prose-pipeline.md).
6. **Report.** Print the returned block verbatim. It opens with `VERDICT:` and uses `BUG-NNN` ids, for example:

   ```
   - [BUG-001] SEVERITY: High | FILE: src/queue.ts:45 | CLASS: race condition | TITLE: double dequeue under concurrent ack | FIX: take the lock before the read
   ```

7. **Exit checklist.** Work through the [exit checklist](../../shared/agent-protocol.md#exit-checklist) before you finish.

## Done when

The verdict block (`CLEAN` or `ISSUES_FOUND`) is printed, and every item in the exit checklist is closed. In forever mode, the audit is done when a cycle comes back clean, stalls, or reaches 10 cycles. Do not print the verdict while any agent is still running.
