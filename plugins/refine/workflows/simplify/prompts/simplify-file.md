# Simplify files (behavior-preserving)

Simplify each target file in `FILES` for clarity, reuse, efficiency, and architectural fit **without changing behavior**. Give every file its own pass; one batch is not a license to skim.

## Worktree pin

If the prompt includes a `WORKTREE PIN` block, every `Edit`/`Write` and every `git` command stays inside `WORKTREE`:

- The supplied `FILES` are already absolute paths under `WORKTREE`; use them verbatim.
- Run `git` as `git -C ${WORKTREE} ...`. Bare `git` runs in the orchestrator's tree, not yours.
- If a missing abstraction or cross-file extraction tempts you to touch a sibling file, that sibling must also be under `WORKTREE`. If it is not, leave the abstraction in place and note it in your summary.
- If anything in the deletion ladder or architecture pass would require editing outside `WORKTREE`, return `changed=false` with a brief reason.

## Leave only intended edits

- Copy a sibling file to its snapshot before editing it, the same as a target file. A new file you create (an extracted helper) has no snapshot, so name it in your summary so that the reviewer can delete it on a revert.
- Create no scratch files, backups (`*.bak`, `*.orig`), or logs, and run no `git stash`, `git commit`, `git checkout`, or branch command. The reviewer and the orchestrator handle reverts.
- Do not run formatters or code generators over files outside `FILES`.

## Deletion ladder

Prefer deleting code over rewriting it. Walk this ladder top to bottom and stop at the first rung that holds:

1. **Does this code need to exist at all?** Speculative-future code, dead branches, unused exports, single-implementation interfaces, factories with one product, config knobs for values that never change, error handling for impossible cases → delete.
2. **Stdlib covers it?** Replace hand-rolled with the standard library (e.g. `lru_cache`, `dataclass`, `pathlib`, `itertools`, `Object.entries`, `Array.flatMap`).
3. **Native platform feature covers it?** CSS over JS, `<input type="date">` over a picker lib, DB constraint over app-level validation, framework primitive over custom wrapper.
4. **Already-installed dependency solves it?** Use it before adding a new one or hand-rolling.
5. **Can it be one line?** Collapse it.
6. **Only then:** the minimum code that works.

Two rungs apply → take the higher one (more deletion). The shortest working diff wins. These are still **behavior-preserving** edits — the reviewer below will revert anything that changes semantics.

## Clarity

- Reduce unnecessary complexity and nesting.
- Eliminate redundancy.
- Improve names.
- Consolidate related logic.
- Remove comments that just restate the code, reference tasks/PRs/issues, or narrate history.
- Avoid nested ternaries — prefer explicit conditionals.

## Architecture

Apply these only when it makes **today's** code easier to reason about — not for hypothetical future callers.

- **Missing abstractions** — non-trivial logic inlined in 4+ places, the same 5+ args threaded through a chain, or one function juggling several responsibilities → extract a named helper / struct / context object.
- **Bad separation of concerns** — IO mixed with pure logic, parse/validate/persist tangled, business logic in UI/transport code, config construction interleaved with use → split along the responsibility seam.
- **Isolation / coupling** — modules reaching into another module's internals, shared mutable state across boundaries, leaky abstractions, circular imports, god objects → tighten the interface.

## Don't over-simplify

- No clever one-liners that obscure intent.
- Don't merge unrelated concerns.
- Keep abstractions that earn their keep (used in 4+ places, or hide real complexity).
- Prefer readable, explicit code over compact cleverness.
- Never simplify away: input validation at trust boundaries, error handling that prevents data loss, security checks, accessibility basics, anything explicitly requested.

## When simplicity needs a label

If you deliberately leave a simple-but-bounded shortcut (global lock instead of per-key, O(n²) scan, naive heuristic, in-memory cache), name the ceiling and upgrade path in a one-line comment so a future reader sees intent, not ignorance:

```
# simple: global lock; switch to per-key locks if throughput matters
```

Only when the ceiling is non-obvious. Don't litter the file with these.

## Behavior preservation

All edits must preserve behavior. An adversarial reviewer runs after you and will revert any change that alters semantics (different output, edge cases like None-vs-falsy/0/"", control flow, error paths, types, side effects, evaluation order).

## Output

Edit a file in place **only** if there is a real improvement. Return one result per file:

- If you edited the file: `changed=true` with a summary of at most 20 words, naming any file you created.
- If you did not edit the file: `changed=false`.
