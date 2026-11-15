---
name: security
description: Hunt for exploitable vulnerabilities by reading a codebase's source — injection, broken access control, secrets, dependency CVEs. Source analysis plus installed offline scanners (osv-scanner, gitleaks, semgrep); never a live remote API or runtime test. PoC exploits are opt-in, never executed; a refused PoC is recorded as declined.
effort: high
---

$ARGUMENTS

# Security audit

This skill does adversarial vulnerability research on source code. This is authorized, defensive work: the user owns the code or is authorized to test it, and the goal is to find and fix weaknesses before an attacker does. Say so at the top of every finder, disprover, referee, and PoC prompt you write. Everything here reads source or runs local scanners. Nothing runs against a live system.

| Role | Goal |
|---|---|
| **Finder** (hunter) | Find real, exploitable vulnerabilities, each with a traced path from input to impact |
| **Disprover** (skeptic) | Verify or refute each finding against the code |
| **Referee** | Read the code independently and give the final verdict: `EXPLOITABLE`, `CONDITIONAL`, or `NOT_EXPLOITABLE` |

The shared conventions are in [agent-protocol.md](../../shared/agent-protocol.md): path choice, modes, fix-mode safeguards, cost knobs, findings format, and the exit checklist. The agent prompts are in [`workflows/security/prompts/`](../../workflows/security/prompts/): [recon](../../workflows/security/prompts/recon.md), [hunter](../../workflows/security/prompts/hunter.md), [dedup](../../workflows/security/prompts/dedup.md), [skeptic](../../workflows/security/prompts/skeptic.md), [referee](../../workflows/security/prompts/referee.md), [poc](../../workflows/security/prompts/poc.md), and [fix](../../workflows/security/prompts/fix.md).

## What counts

- **No hypotheticals.** Every finding traces attacker-controlled input to its impact.
- **Adversarial verification is mandatory.** No finding goes into the report until it survives a disprover and a referee.
- **Read, don't grep.** Scanner hits are leads for finders to confirm in the code, not findings by themselves.
- **CVEs come from offline tools.** [recon.md](../../workflows/security/prompts/recon.md) lists the public scanners and the exact offline commands: `osv-scanner`, `gitleaks`, `semgrep`, `trivy`, and per-language tools. Run only the scanners that are installed. Never query a remote vulnerability API live, because per-package queries disclose the project's package and version inventory. If no offline CVE scanner is available, record a coverage gap. A CVE that comes only from training data is marked `training-data-only`, and the engine downgrades it to CONDITIONAL.
- **Say what was skipped.** The report lists each scanner as ran or skipped, with the reason, under Coverage Gaps. Do not install a tool unless the user asks.

## Run

1. **Path.** Choose inline, workflow, or prose pipeline from [the table](../../shared/agent-protocol.md#choose-the-path). A target of 1-3 small files runs inline with no agents. Recon and the scanners still run.
2. **Temp dir.** Make `AUDIT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/audit-security.XXXXXX")` on every path, because scanner output goes there and never into the project. Pass the literal path to recon.
3. **Scope.** If the user named files or a module, collect them with `Glob` and set `scope.constrained: true`. If not, pass the project root. At 300+ files, the config runs a triage pass, then deep-reads only the high-risk files.
4. **Mode.** The default mode is report-only. For `--fix` or `--forever`, do the [fix-mode safeguards](../../shared/agent-protocol.md#fix-mode-safeguards) first. Fix agents never write or run exploit code.
5. **PoC sketches** are opt-in. Set `args.pocPhase: true` only when the user explicitly asks for proof-of-concept exploits. Sketches are text in the report. Nothing is written to disk, and nothing is executed: execution is a human decision. If the PoC agent declines or ends with `stop_reason: "refusal"`, the report says `PoC declined: <reason>`, and the confirmed findings stand. Do not reword the request and retry it.
6. **Budget and knobs.** State the budget, and set `args.effort` or `args.model` if needed ([Before launch](../../shared/agent-protocol.md#before-launch)).
7. **Launch** (workflow path). Read `${CLAUDE_PLUGIN_ROOT}/skills/security/audit.config.json`, merge in `scope`, the mode flags, and `pocPhase`, and run:

   ```
   Workflow({
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/security/audit.js",
     args: { ...<merged config>, promptsDir: "${CLAUDE_PLUGIN_ROOT}/workflows/security/prompts" }
   })
   ```

   Pass `scratchDir: "<literal $AUDIT_DIR>"` so that recon writes scanner output there. If `${CLAUDE_PLUGIN_ROOT}` does not expand inside `scriptPath`, resolve it with `echo "${CLAUDE_PLUGIN_ROOT}"`. If the tool is missing or disabled, use the [prose pipeline](../../shared/prose-pipeline.md). There, you run recon yourself.
8. **Report.** Print the returned block verbatim. It uses `VULN-NNN` ids for source findings and `DEP-NNN` ids for dependency findings, for example:

   ```
   - [VULN-001] SEVERITY: Critical | FILE: api/search.py:45 | CLASS: SQL injection | CONFIDENCE: source-analysis | TITLE: raw query from q param | FIX: parameterize the query
   - [DEP-001] SEVERITY: High | FILE: web/render.js:12 | CLASS: prototype pollution | CONFIDENCE: tool-verified | CVE: CVE-YYYY-NNNNN | TITLE: vulnerable merge helper | FIX: upgrade to the fixed version
   ```

9. **Exit checklist.** Work through the [exit checklist](../../shared/agent-protocol.md#exit-checklist) before you finish. The final `rm -rf "$AUDIT_DIR"` also removes the scanner output, which can contain redacted secret locations.

## Done when

The verdict block (`CLEAN` or `ISSUES_FOUND`) is printed with the scanner coverage line, and every item in the exit checklist is closed. In forever mode, the audit is done when a cycle comes back clean, stalls, or reaches 10 cycles. Do not print the verdict while any finder, disprover, referee, PoC, or fix agent is still running.
