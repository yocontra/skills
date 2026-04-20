---
name: code-simplify
description: Clean up recently written code — dead code, missed abstractions, over-engineered error handling, redundant logic, unclear naming. Use when the user just finished an implementation and wants a cleanup pass, when a diff looks messy, or when the user asks to simplify, tidy, or polish recent changes.
user-invocable: true
argument-hint: "[optional: path or scope to focus on]"
allowed-tools: Read, Grep, Glob, Edit, Bash
---

$ARGUMENTS

# Code Simplify

Pass-over the recently changed code and remove what doesn't pull its weight. Preserve behavior exactly — this is not a refactor, it's a cleanup.

## Scope

Default scope is **uncommitted changes** — what the user just wrote. Do not touch code outside the diff unless explicitly asked.

```bash
git diff --name-only                    # modified tracked files
git status --porcelain | awk '{print $2}'  # include untracked
```

If `$ARGUMENTS` names a path, use that path as scope instead.

## What to Look For

Run through the changed files and flag anything that matches these patterns. Each one maps to a specific fix.

### Dead or redundant code
- Unused variables, parameters, imports, helpers
- Commented-out code left behind
- Early-returns after unreachable branches
- `if (x) return x; else return y;` → `return x || y` when semantics allow
- Duplicate logic (three similar lines is fine; four+ usually means extract)

### Over-engineering
- Wrapper functions that only forward arguments
- Abstractions with one call site ("premature abstraction" — inline)
- Try/catch that catches an error only to rethrow or log-and-rethrow
- Fallbacks for cases that cannot happen (framework guarantees, internal-only callers)
- Validation inside internal code — only validate at system boundaries (user input, external APIs)
- Config/flags that are always the same value in practice

### Readability
- Unclear names: `data`, `tmp`, `x`, `handle`, `doThing` — rename to what it represents
- Nested ternaries (`a ? b : c ? d : e`) → if/else
- Deep nesting (>3 levels) → early returns or extract a function
- Mixed levels of abstraction in one function (high-level orchestration beside bit-twiddling)
- Boolean parameter flags that flip behavior (`doSomething(true, false, true)`) → split into two functions or use a named options object

### Comments
- Comments that restate the code (`// increment i` above `i++`)
- Comments referencing a task, ticket, PR, or previous implementation ("used to be X", "for issue #123")
- TODOs with no owner or date that clearly won't be done
- Docstrings that are longer than the function itself and add nothing

**Keep:** comments explaining *why* (hidden constraint, subtle invariant, workaround for a specific bug, behavior that would surprise a reader).

### Error handling
- `try { … } catch (e) { throw e }` — delete the try
- `try { … } catch (e) { console.log(e); throw e }` — delete unless the log path is actually used
- Handling errors that cannot occur (e.g. catching `JSON.parse` errors when the input is a hardcoded literal)
- Swallowed errors (`catch { /* ignore */ }`) — unless the reason is documented

### Types & signatures
- Return types that lie (`Promise<any>`, `unknown` when the actual type is clear)
- Optional parameters that are always passed
- Union types where one branch is never used

## Process

1. **Identify the diff.** List the files in scope. If the scope is large (>10 files), ask the user to confirm before proceeding.
2. **Read each changed file.** Look for the patterns above. Build a list of proposed fixes as you go.
3. **Present a plan** before editing — a short table: `file:line — pattern — proposed fix`. Let the user veto anything they disagree with.
4. **Apply fixes** via Edit. Group related fixes per file.
5. **Verify behavior is preserved.** If the project has tests, run them. If it has a type-checker or linter, run it. Report the result.

## Output format

After fixes, return a summary in this shape:

```
Applied N fixes across M files:
  <file>:<line> — <what changed> — <why>
  ...

Skipped (needs human judgment):
  <file>:<line> — <pattern> — <reason to skip>

Verification: <tests pass | typecheck clean | nothing to run>
```

## What NOT to do

- Don't rename public exports, API fields, or external symbols — that's an API change, not simplification.
- Don't reformat whitespace or run a formatter — that pollutes the diff.
- Don't "modernize" syntax (e.g. `var` → `const`) unless the file is part of the current diff.
- Don't add error handling, validation, or fallbacks that weren't there. This is a *remove* pass, not an add pass.
- Don't touch code outside the diff scope.
- Don't simplify so aggressively that the code becomes harder to debug. If removing something makes a stack trace or log less useful, leave it.
- Don't bundle simplification with feature changes. Pure cleanup only.

## Hand-offs

- If the diff reveals a real bug (not a style issue), surface it separately and do not fix it in this pass — bug fixes belong in their own change.
- If the code looks fundamentally wrong (wrong architecture, wrong algorithm), say so and stop. This skill is for local cleanup, not redesign.
- If you find security issues, hand off to `security-audit`.
- If you find performance issues, hand off to `perf-audit`.
