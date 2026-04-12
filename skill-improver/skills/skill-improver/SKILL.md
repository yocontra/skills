---
name: skill-improver
description: Review and fix Claude Code skill files. Catches broken frontmatter, ambiguous instructions, and prompt anti-patterns.
user-invocable: true
argument-hint: "[path to SKILL.md or plugin directory]"
allowed-tools: Read, Glob, Grep, Write, Edit, Agent, AskUserQuestion
---

$ARGUMENTS

# Skill Improver

## Step 1: Load the skill

If given a directory, find the SKILL.md:
```
Glob for **/SKILL.md in the given path
```

If given a file path, read it directly. Also read the plugin.json if one exists nearby.

## Step 2: Review

Evaluate the skill against these categories. For each issue found, classify it:

### Critical (blocks loading or causes errors)
- Missing or malformed frontmatter (no `---` delimiters, missing `name`)
- `allowed-tools` references tools that don't exist
- File exceeds 400 lines without reference file decomposition
- Syntax errors in code blocks that agents will try to parse

### Major (degrades effectiveness)
- Ambiguous instructions — an agent following them could reasonably do the wrong thing
- Missing constraints — agents will do things the skill author didn't intend
- No output format specified — agents produce inconsistent results
- Missing error handling — what happens when a tool call fails?
- Conflicting instructions — two sections tell the agent to do different things
- Missing `$ARGUMENTS` after frontmatter
- Overly rigid — instructions that break when the target doesn't match assumptions
- Missing mode handling — skill only works for one type of input

### Minor (evaluate before fixing)
- Verbose where concise would work — agents don't need motivation or backstory
- Redundant instructions — same thing said multiple ways
- Missing edge cases — what if the input is empty? What if there are 1000 files?
- Inconsistent terminology — same concept called different names
- Missing `user-invocable` or `argument-hint` in frontmatter

## Step 3: Report

Present findings as a table:

```
| # | Severity | Line(s) | Issue | Suggested fix |
|---|----------|---------|-------|---------------|
```

## Step 4: Fix

After presenting the report, ask the user:
- "Fix all critical and major issues?" (default yes)
- "Fix minor issues too?" (default no — some may be intentional)

Then apply fixes. For each fix:
1. Make the edit
2. Verify it doesn't break other parts of the skill
3. If the file is over 400 lines, decompose into SKILL.md + reference/ files

## Step 5: Verify

After all fixes, re-read the skill and do a final check:
- Frontmatter parses correctly
- All referenced files/paths exist
- Instructions are internally consistent
- Line count is under 400

Report: "N issues found, N fixed, N remaining (minor, deferred)."

## Quality Principles

- **Agents are literal.** They follow instructions exactly. Ambiguity = unpredictable behavior.
- **Constraints prevent harm.** Missing constraints mean agents will take actions you didn't intend. "READ-ONLY" must be explicit if that's the intent.
- **Output format is a contract.** Downstream consumers (other agents, parsers, the user) depend on consistent output. Specify it precisely.
- **Reference decomposition scales.** Skills over 400 lines should split detailed content (prompt templates, checklists, lookup tables) into `reference/` files that agents Read on demand.
- **$ARGUMENTS enables invocation.** Without it, user arguments don't reach the skill.
- **Test the unhappy path.** What happens when the target is empty? When a tool errors? When the input doesn't match assumptions? Good skills handle these.

## Anti-patterns to flag

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Motivational preamble | "You are an incredibly skilled..." wastes tokens | Cut it. Start with what to do. |
| Unbounded output | "List all..." with no limit | Add limits or pagination |
| Implicit tool access | Instructions assume tools without listing in `allowed-tools` | Add to frontmatter |
| Hardcoded paths | `/Users/john/project/...` | Use relative paths or variables |
| Missing agent constraints | No READ-ONLY / no-execute mentioned | Add explicit constraints |
| Nested prompt templates without escaping | `${}` in templates that will be interpolated twice | Use clear variable markers |
| Giant inline prompts | 50+ line prompt templates in SKILL.md | Move to `reference/` |
