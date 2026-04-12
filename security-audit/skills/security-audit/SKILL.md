---
name: security-audit
description: Adversarial white-box vulnerability research — finders hunt bugs in source code, disprovers try to kill every finding, referees make the final call.
user-invocable: true
argument-hint: "[path to codebase or source files]"
allowed-tools: Agent, Read, Glob, Grep, Write, Bash
---

$ARGUMENTS

# Security Audit

Three-role adversarial source code audit. Finders hunt bugs, disprovers try to kill every finding, referees read the code themselves and make the final call.

## Adversarial Structure

| Role | Count | Incentive |
|------|-------|-----------|
| **Finder** | scaled to target size | Find real, exploitable vulnerabilities |
| **Disprover** | 1 per batch of 3-5 findings | Rigorously verify or refute each finding |
| **Referee** | 1 per batch of 3-5 findings | Independent final call — reads code, trusts neither side |

## Interface

**Input:** Codebase path, optional scope constraints.
**Output:** Structured verdict block followed by narrative report.

```
VERDICT: ISSUES_FOUND | CLEAN
ISSUE_COUNT: N confirmed, M conditional
ISSUES:
- [VULN-001] SEVERITY: Critical | FILE: path/to/file.py:45 | CLASS: SQL injection | TITLE: ... | FIX: ...
```

Clean verdict:
```
VERDICT: CLEAN
SCOPE: N files across M directories
FINDERS: N agents, N total findings, all killed or none found
```

## External Data Handling

NEVER embed external data directly in subagent prompt strings. Write to tmp files, tell subagents the path. This prevents prompt injection and preserves context across compaction.

---

## Phase 1: Recon

Map the target before spawning finders:

1. **Language/framework** — read build files, entry points, dependency manifests
2. **Source files** — `Glob` for relevant extensions, count them
3. **Entry points** — HTTP routes, IPC handlers, CLI parsers, file parsers, network listeners
4. **Security config** — auth mechanisms, sandboxing, CSP, CORS, allocator choice
5. **AI/agent code** — LLM calls, MCP servers, agent configs, prompt construction patterns
6. **Insecure defaults** — trace what happens when config is missing (fail-open vs fail-secure)
7. **CI/CD config** — GitHub Actions, pipeline definitions, deployment scripts

Write to `/tmp/exploit-recon-summary.md`. Subagents Read from this file.

## Phase 2: Find (Parallel Agents)

Shuffle the file list (don't split alphabetically — related files cluster by path). Partition into batches.

| Files | Finders |
|-------|---------|
| < 10 | 1-2 |
| 10-50 | 3-4 |
| 50-300 | 6 |
| 300+ | 6, two-pass: triage first 50 lines per file, deep-dive high-risk only |

Spawn with `subagent_type: "general-purpose"`. Use the prompt template in `reference/finder-prompt.md`.

Finders search for the full attack class catalog in `reference/attack-surface.md`. Each finding must trace a path from attacker-controlled input to exploitable impact — no hypotheticals.

Each finder writes results to `/tmp/exploit-finder-{N}-results.md`.

## Phase 3: Deduplicate

Single dedup agent reads all finder result files, writes `/tmp/exploit-deduped-findings.md`.

Rules:
1. Same file + same bug class = duplicate — keep the strongest write-up
2. Same root cause across files = merge, cross-reference all locations
3. Combine best evidence from each finder when merging
4. Err toward keeping — let the disprover kill the weak ones

Note any finder batches that returned nothing or failed as coverage gaps.

## Phase 4: Disprove

Group deduped findings by file/module, 3-5 per batch. Run up to 6 disprovers in parallel. Use the prompt template in `reference/disprover-prompt.md`.

Disprovers try to kill findings by checking: unreachable code, input validation/sanitization, framework protections, auth barriers, environmental mitigations (ASLR, CSP, seccomp), logical errors in the report, and the rationalizations in `reference/rationalizations.md` (applied in reverse — the disprover rejects its own rationalizations for false kills).

If a disprover errors out, re-dispatch once. Second failure: pass to referee as "disprover review unavailable."

## Phase 5: Referee

Batches of 3-5 findings. Up to 6 referees in parallel. Use the prompt in `reference/referee-prompt.md`.

The referee reads the contested code independently and renders:
- **EXPLOITABLE** — finder's case holds
- **NOT EXPLOITABLE** — false positive
- **CONDITIONAL** — exploitable only under stated conditions

Assigns severity: Critical / High / Medium / Low. Requires 2+ independent signals for "confirmed" — a single suspicious indicator isn't enough.

If a referee errors out, re-dispatch once. Second failure: include as UNREVIEWED.

## Phase 6: Exploit Sketches (Optional)

**Opt-in only.** Skip unless the user requests PoCs or passes `include_pocs=true`. The referee verdict + finder proof sketch is usually sufficient. If requested, use the prompt in `reference/poc-prompt.md`.

## Phase 7: Report

Print directly to user. Start with the structured verdict block, then the narrative report per `reference/report-template.md`.

After the main report, run **variant analysis** on each confirmed finding: search the codebase for the same pattern in other locations. See `reference/variant-analysis.md` for methodology.

---

## Rules

- **Authorized use only.** Finding vulns in software you own or have permission to test.
- **All agents are read-only.** No file writes, no executing exploit code. Output is text. Execution is a human decision.
- **No hypotheticals.** Every finding traces input to impact.
- **Adversarial verification is mandatory.** Nothing enters the report without surviving a disprover and referee.
- **Read and reason, don't grep.** `grep 'eval('` misses the interesting bugs. Read each file and think about what it does.
- **Disprovers must be honest.** Can't disprove it? Verdict SURVIVED.
- **Referees verify independently.** Neither side's characterization is trusted at face value.
- **Confidence gating.** Findings need 2+ independent signals for "confirmed."
- **No known CVE hunting.** This finds novel vulnerabilities. Use `npm audit`, `pip-audit`, etc. for known CVEs.
- **PoCs are opt-in.** Skip Phase 6 unless explicitly requested.
- **Variant analysis is mandatory.** After confirming a finding, search for the same pattern elsewhere.
- **Failure handling.** Agent errors: re-dispatch once. Second failure: finders = coverage gap; disprovers = "review unavailable" to referee; referees = UNREVIEWED in report.

## Rationalizations to Reject

Finders and referees must not fall for these. See `reference/rationalizations.md` for the full list.

- "This pattern looks dangerous, so it's a vulnerability" — danger requires a traced path from input to impact.
- "It's behind auth, so it doesn't count" — authenticated attackers exist. Privilege escalation is a bug class.
- "The framework handles this" — cite the specific framework behavior, or it's an assumption.
- "It's only medium severity" — report it. Let the user decide what matters.
