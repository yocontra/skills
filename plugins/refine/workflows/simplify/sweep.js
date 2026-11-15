export const meta = {
  name: 'simplify-sweep',
  description: 'Simplify changed code for clarity, reuse, efficiency, and architectural fit while preserving behavior. One simplifier for a small diff or one per file for a larger one (extracting helpers / fixing separation of concerns / isolation issues when warranted), an adversarial behavior-preservation reviewer that auto-reverts risky edits, and a convergence loop with oscillation detection.',
  phases: [
    { title: 'Simplify', detail: 'simplifiers refine files in place (behavior-preserving)' },
    { title: 'Review', detail: 'adversarial reviewer proves behavior unchanged or reverts the file' },
  ],
}

/* ─── Operations ─────────────────────────────────────────
 * Phases (per pass):
 *   Simplify → files are batched: all of them in ONE batch when
 *              args.changedLines is under args.oneAgentBelow (default 150)
 *              and this is not forever mode, else one batch per file (waves
 *              of MAX_CONC=16). One agent per batch. Before its first edit
 *              of a file it copies the file to args.snapshotDir, then edits
 *              in place if it finds a real improvement.
 *   Review   → one agent per batch that changed something. It diffs each
 *              changed file against its snapshot copy and restores any edit
 *              whose behavior it can show diverged by copying the snapshot
 *              back, which keeps the user's own uncommitted work (a
 *              `git checkout -- <file>` would discard it). Skipped if no
 *              files changed.
 *   Gate     → 0 or 1 agent (only if args.runGate.enabled && command). Runs
 *              user-supplied test/lint command from `worktree`, reports pass/fail.
 *              A gate that could not run, or ran in another directory, fails.
 *              Once at end (single-pass) or after each terminal condition
 *              (forever mode).
 *
 * Total fan-out:
 *   Small diff:  1 simplifier + ≤1 reviewer + (0|1 gate).
 *   Single pass: files + (≤files) + (0|1 gate) ≈ 1–2× |files| + ≤1.
 *   Forever:     up to CAP passes (default 10), each pass same fan-out. Caps at
 *                ~20× |files| + CAP gate runs. Loop exits early on no-survivor
 *                pass or repeated changedFiles fingerprint (oscillation).
 *
 * Protocols are INLINED: prompts/*.md are copied into this script by
 * scripts/sync-workflow-prompts.mjs (pre-commit checks the copies), so no
 * agent spends a turn reading them.
 *
 * Smoke-test args (fast read-only-ish; simplifier may still edit files —
 * there is NO dryRun flag, so use a clean tree and `git checkout` to undo):
 *   { files: ["path/to/one-small-file.js"], changedLines: 20,
 *     snapshotDir: "/tmp/claude-skills/simplify/smoke",
 *     standards: "be conservative",
 *     forever: { enabled: false },
 *     runGate: { enabled: false } }
 *
 * Scope-limit knobs:
 *   files          — the main scope control; trim this list to bound work.
 *   changedLines / oneAgentBelow — diff size, and the size under which one
 *                    agent simplifies every file (default 150).
 *   snapshotDir    — fresh directory for pre-edit copies. Without it the
 *                    reviewer reports behavior changes but cannot revert.
 *   forever.enabled / forever.cap (default 10) — caps pass count.
 *   runGate.enabled — adds 1 gate agent per terminal pass.
 *   MAX_CONC=16    — wave size (constant; edit source to change).
 *   No applyFixes / dryRun / verifyFindings flags exist — simplifier always
 *   writes to disk; reviewer always runs (and may revert).
 *
 * Mutating phases:
 *   Simplify — copies files into snapshotDir, writes to the files in its
 *              batch (in place).
 *   Review   — copies snapshots back over files to revert (also any sibling
 *              files the simplifier created/edited).
 *   Gate     — writes nothing (runs external command).
 *
 * Common failure modes:
 *   - Simplifier edits a file without copying it first, or no snapshotDir
 *     was passed: the reviewer finds no snapshot and reports instead of
 *     reverting.
 *   - Simplifier response fails schema/parse: withRetry's onFail
 *     force-routes {changed:true} so the reviewer inspects the on-disk edit.
 *   - Reviewer double-fails: edit stays on disk, reported as "unverified" —
 *     surfaced in final ledger; user must inspect manually.
 *   - Oscillation: same changedFiles set across passes → STALLED report
 *     (conflicting simplification targets).
 *
 * Quick check-in: shared/workflows/OPERATIONS.md has recipes for locating the
 *   run's journal.jsonl and reading finished agents' results cheaply.
 * ─────────────────────────────────────────────────────── */

// simplify-sweep workflow. The launcher resolves the file list (default
// `git diff --name-only`) and passes it. Simplifier agents edit files in place;
// the behavior-preservation reviewer reads each diff and reverts any file whose
// behavior it can show changed. Converges when a pass makes no surviving
// change, or stops on oscillation (same change set as a prior pass).
//
// args = { files: [...], changedLines, oneAgentBelow, snapshotDir, standards,
//          worktree, forever:{enabled,cap}, runGate:{enabled,command},
//          model:{simplify,review,gate}, effort:{simplify,review,gate} }
//
// `worktree`: absolute path to the git worktree this sweep is allowed to touch.
// Subagents inherit the orchestrator's cwd, which can drift from the caller's
// intended target (e.g. when invoked from one repo to operate on a sibling
// worktree). When set, every per-file path is joined with `worktree` and every
// `git` command runs with `-C ${worktree}` so edits and reverts can't leak.
// Optional — when null, paths are passed through and `git` runs in the agent's
// cwd (legacy single-tree behavior).

const A = (typeof args === 'object' && args) ? args : {}
const FILES = A.files || []
const STANDARDS = A.standards || "Follow the project's CLAUDE.md coding standards. Prefer readable, explicit code over compact cleverness."
const WORKTREE = A.worktree || null
const FOREVER = A.forever || { enabled: false }
const CAP = FOREVER.cap ?? 10
const GATE = A.runGate || { enabled: false }
const MAX_CONC = 16
const rawChanged = A.changedLines == null ? NaN : Number(A.changedLines)
const rawOneAgent = A.oneAgentBelow == null ? NaN : Number(A.oneAgentBelow)
const ONE_AGENT_BELOW = Number.isFinite(rawOneAgent) ? rawOneAgent : 150
// A small diff does not need an agent per file, each re-paying the system
// prompt and protocol for a few lines of change. Forever mode sweeps whole
// files, so the diff size says nothing about its work.
const ONE_BATCH = !FOREVER.enabled && Number.isFinite(rawChanged) && rawChanged < ONE_AGENT_BELOW
const SNAPSHOT_DIR = A.snapshotDir ? A.snapshotDir.replace(/\/+$/, '') : null
// Per-role model and effort. An omitted model inherits the session model. The
// simplifier fleet dominates the bill in per-file mode; keep the reviewer on the
// session model, since it decides what survives.
const MODEL = A.model || {}
const EFFORT = { simplify: 'medium', review: 'high', gate: 'low', ...(A.effort || {}) }
const opts = (role) => ({ effort: EFFORT[role], ...(MODEL[role] ? { model: MODEL[role] } : {}) })

// Where a file's pre-edit copy lives for one pass. Per pass, so a revert in
// pass 3 restores pass 3's starting point rather than undoing passes 1–2.
const snapshotOf = (file, passNum) => `${SNAPSHOT_DIR}/pass-${passNum}/${file.replace(/\//g, '__')}`

// Anchor a path under WORKTREE. Already-absolute paths are left alone so the
// caller can mix in absolute paths from other tools without us double-joining.
function anchor(p) {
  if (!WORKTREE) return p
  if (p.startsWith('/')) return p
  return WORKTREE.replace(/\/+$/, '') + '/' + p.replace(/^\/+/, '')
}

// Block injected into every agent prompt when worktree is pinned.
const WORKTREE_PIN = WORKTREE
  ? `

WORKTREE PIN — STRICT:
- WORKTREE: ${WORKTREE}
- The FILES paths below are already absolute under WORKTREE.
- Every Edit/Write you do MUST target a path under ${WORKTREE}. Refuse if asked to touch anything outside it.
- Every \`git\` command MUST be run as \`git -C ${WORKTREE} ...\`. Bare \`git\` will run in the wrong tree.
- Do not edit files in any sibling repo.`
  : ''

const withRetry = async (thunk, onFail) => {
  try { return await thunk() } catch { try { return await thunk() } catch { return onFail() } }
}

const SIMPLIFY_SCHEMA = {
  type: 'object',
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'changed'],
        properties: { file: { type: 'string' }, changed: { type: 'boolean' }, summary: { type: 'string' } },
      },
    },
  },
}
const REVIEW_SCHEMA = {
  type: 'object',
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'preserved', 'reverted'],
        properties: { file: { type: 'string' }, preserved: { type: 'boolean' }, reverted: { type: 'boolean' }, reason: { type: 'string' } },
      },
    },
  },
}
const GATE_SCHEMA = {
  type: 'object',
  required: ['passed', 'ran', 'cwd'],
  properties: { passed: { type: 'boolean' }, ran: { type: 'boolean' }, cwd: { type: 'string' }, detail: { type: 'string' } },
}

// prompt-sync:begin prompts/simplify-file.md
const SIMPLIFY_PROTOCOL = `# Simplify files (behavior-preserving)

Simplify each target file in \`FILES\` for clarity, reuse, efficiency, and architectural fit **without changing behavior**. Give every file its own pass; one batch is not a license to skim.

## Worktree pin

If the prompt includes a \`WORKTREE PIN\` block, every \`Edit\`/\`Write\` and every \`git\` command stays inside \`WORKTREE\`:

- The supplied \`FILES\` are already absolute paths under \`WORKTREE\`; use them verbatim.
- Run \`git\` as \`git -C \${WORKTREE} ...\`. Bare \`git\` runs in the orchestrator's tree, not yours.
- If a missing abstraction or cross-file extraction tempts you to touch a sibling file, that sibling must also be under \`WORKTREE\`. If it is not, leave the abstraction in place and note it in your summary.
- If anything in the deletion ladder or architecture pass would require editing outside \`WORKTREE\`, return \`changed=false\` with a brief reason.

## Leave only intended edits

- Copy a sibling file to its snapshot before editing it, the same as a target file. A new file you create (an extracted helper) has no snapshot, so name it in your summary so that the reviewer can delete it on a revert.
- Create no scratch files, backups (\`*.bak\`, \`*.orig\`), or logs, and run no \`git stash\`, \`git commit\`, \`git checkout\`, or branch command. The reviewer and the orchestrator handle reverts.
- Do not run formatters or code generators over files outside \`FILES\`.

## Deletion ladder

Prefer deleting code over rewriting it. Walk this ladder top to bottom and stop at the first rung that holds:

1. **Does this code need to exist at all?** Speculative-future code, dead branches, unused exports, single-implementation interfaces, factories with one product, config knobs for values that never change, error handling for impossible cases → delete.
2. **Stdlib covers it?** Replace hand-rolled with the standard library (e.g. \`lru_cache\`, \`dataclass\`, \`pathlib\`, \`itertools\`, \`Object.entries\`, \`Array.flatMap\`).
3. **Native platform feature covers it?** CSS over JS, \`<input type="date">\` over a picker lib, DB constraint over app-level validation, framework primitive over custom wrapper.
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

\`\`\`
# simple: global lock; switch to per-key locks if throughput matters
\`\`\`

Only when the ceiling is non-obvious. Don't litter the file with these.

## Behavior preservation

All edits must preserve behavior. An adversarial reviewer runs after you and will revert any change that alters semantics (different output, edge cases like None-vs-falsy/0/"", control flow, error paths, types, side effects, evaluation order).

## Output

Edit a file in place **only** if there is a real improvement. Return one result per file:

- If you edited the file: \`changed=true\` with a summary of at most 20 words, naming any file you created.
- If you did not edit the file: \`changed=false\`.
`
// prompt-sync:end

// prompt-sync:begin prompts/behavior-preservation-review.md
const REVIEW_PROTOCOL = `# Adversarial behavior-preservation review

You are an **adversarial behavior-preservation reviewer**. A simplifier just edited the files in \`FILES\`. Your job, for each file, is to try to **prove** the change altered behavior, and revert the file if you can.

Each file comes with a **snapshot**: a copy the simplifier made just before editing it. It holds the file as the simplifier found it, including the user's own uncommitted changes. Diff and restore against the snapshot, never against git: restoring from \`HEAD\` throws away the user's uncommitted work along with the simplifier's edit.

## Worktree pin

If the prompt includes a \`WORKTREE PIN\` block, you are reviewing a single git tree:

- The \`FILES\` paths are already absolute under \`WORKTREE\`.
- Run every \`git\` command as \`git -C \${WORKTREE} ...\`.
- When checking sibling files for cross-file extractions, inspect and revert only files that resolve under \`WORKTREE\`. If the simplifier appears to have touched a file outside \`WORKTREE\`, treat that as a behavior change you cannot safely revert: return \`preserved=false\`, \`reverted=false\`, and report the out-of-tree path in your reason so the orchestrator can surface it.

## Procedure

1. Run \`diff -u <snapshot> <file>\` to see exactly what the simplifier changed.
2. Try to PROVE the change altered behavior. Look for:
   - Different output.
   - Edge cases: None-vs-falsy, \`0\`, \`""\`, empty collections, missing keys.
   - Control flow changes.
   - Error paths (different exception types, swallowed errors, new throws).
   - Type changes (return types, coercions).
   - Side effects (timing, ordering, count of side effects).
   - Evaluation order (especially in short-circuits and lazy sequences).

## Cross-file extractions

If the simplifier extracted a helper, split a class, or moved logic across files, **also verify call sites**:

- Run \`git -C <worktree> status --short\` to see any sibling files touched or created, and diff each against its snapshot if it has one.
- Grep for callers of any moved or renamed symbols.
- An extraction that breaks a caller, changes the import surface, or alters when a side effect fires is a **behavior change**.

## Missing snapshots

If a file's snapshot does not exist, the simplifier edited it without copying it first, or the run has no snapshot directory:

- Nothing shows the change and nothing can restore it.
- Read the **full current file** and review it directly for behavior risk.
- Do not revert it from git. Report any concern with \`preserved=false\`, \`reverted=false\`, and explain it for manual review.

## Decision

Return one result per file, with a reason of at most 40 words. Do not run \`git checkout\`, \`git restore\`, \`git stash\`, or \`git reset\`, and leave no files of your own behind.

- **If you find any behavior change and the snapshot exists**: restore it with \`cp <snapshot> <file>\`, restore any sibling file the simplifier edited from its snapshot, and delete any new file the simplifier created for that edit. Return \`preserved=false\`, \`reverted=true\`, with the reason.
- **If behavior is provably identical**: return \`preserved=true\`, \`reverted=false\`.
- **If the snapshot is missing and you have concerns**: return \`preserved=false\`, \`reverted=false\`, with the reason.
`
// prompt-sync:end

async function inWaves(items, fn) {
  const out = []
  for (let i = 0; i < items.length; i += MAX_CONC) {
    const wave = items.slice(i, i + MAX_CONC)
    out.push(...(await parallel(wave.map((it, j) => () => fn(it, i + j)))))
  }
  return out
}

const BATCHES = (ONE_BATCH ? [FILES] : FILES.map((f) => [f])).map((batch) => batch.map(anchor))
const batchLabel = (batch) => (batch.length === 1 ? batch[0] : `${batch.length} files`)

// Results are matched to their batch by path, so a reply that drops or renames
// a file cannot attach a verdict to the wrong one.
function byFile(results, files, fallback) {
  const got = new Map((results || []).map((r) => [r.file, r]))
  return files.map((file) => got.get(file) || fallback(file))
}

async function onePass(passNum) {
  phase('Simplify')
  const snapshotRule = (files) => SNAPSHOT_DIR
    ? `Before your first edit of a file, copy it to its snapshot with one \`cp\` per file (run \`mkdir -p ${SNAPSHOT_DIR}/pass-${passNum}\` once first). The reviewer restores from these copies, so never edit a file you have not copied.
SNAPSHOTS:
${files.map((f) => `- ${f} -> ${snapshotOf(f, passNum)}`).join('\n')}`
    : `No snapshot directory was given, so a bad edit cannot be reverted. Edit only when you are certain behavior is unchanged.`
  const simplified = await inWaves(BATCHES, async (batch) => {
    const r = await withRetry(
      () =>
        agent(
          `${SIMPLIFY_PROTOCOL}

---

STANDARDS: ${STANDARDS}${WORKTREE_PIN}

Edit a file in place only if there's a real improvement. Return one result per file: changed=true with a summary of at most 20 words if you edited it, else changed=false. Leave only intended edits: no scratch files, backups, stashes, branches, or commits.

${snapshotRule(batch)}

FILES:
${batch.map((f) => `- ${f}`).join('\n')}`,
          { label: `simplify:${batchLabel(batch)}`, phase: 'Simplify', schema: SIMPLIFY_SCHEMA, ...opts('simplify') }
        ),
      // Force-route to reviewer: the agent may have edited files before its response failed.
      () => ({ results: batch.map((file) => ({ file, changed: true, summary: 'simplifier response failed; verify and revert if unsafe' })) })
    )
    const results = byFile(r && r.results, batch, (file) => ({ file, changed: true, summary: 'simplifier returned no result for this file; verify and revert if unsafe' }))
    return results.filter((s) => s.changed)
  })
  const toReview = simplified.filter((changed) => changed && changed.length)
  if (!toReview.length) return { changedFiles: [], reverted: [], unverified: [], summaries: [] }

  phase('Review')
  const reviewed = await inWaves(toReview, async (changed) => {
    const files = changed.map((s) => s.file)
    const revert = SNAPSHOT_DIR
      ? `Each file's pre-edit copy is listed beside it. See what the simplifier changed with \`diff -u <snapshot> <file>\`. If you find any behavior change, restore the file with \`cp <snapshot> <file>\` (and any sibling files the simplifier touched, from their snapshots; delete a sibling file the simplifier created) and return preserved=false, reverted=true with the reason. If a snapshot does not exist, the simplifier edited without copying: do not revert; return preserved=false, reverted=false and describe the problem.`
      : `No snapshots exist for this run, so do not revert: restoring from git would also discard the user's uncommitted work. Return preserved=false, reverted=false and describe any behavior change in the reason.`
    const r = await withRetry(
      () =>
        agent(
          `${REVIEW_PROTOCOL}

---
${WORKTREE_PIN}

Return one result per file, with a reason of at most 40 words. If behavior is provably identical, return preserved=true, reverted=false.

${revert}

FILES (snapshot, then the simplifier's claim):
${changed.map((s) => `- ${s.file}${SNAPSHOT_DIR ? ` (snapshot ${snapshotOf(s.file, passNum)})` : ''}: "${s.summary}"`).join('\n')}`,
          { label: `review:${batchLabel(files)}`, phase: 'Review', schema: REVIEW_SCHEMA, ...opts('review') }
        ),
      () => ({ results: [] })
    )
    const verdicts = byFile(r && r.results, files, (file) => ({ file, preserved: false, reverted: false, reason: 'review failed — left as-is' }))
    return changed.map((s, i) => ({ s, v: verdicts[i] }))
  })
  const pairs = reviewed.filter(Boolean).flat()
  const reverted = pairs.filter(({ v }) => v.reverted).map(({ s }) => s.file)
  // Treat reviewer-failure (preserved !== true) as not-survived so unverified edits aren't reported as clean simplifications.
  const survived = pairs.filter(({ v }) => v.preserved === true && !v.reverted).map(({ s }) => s)
  // Reviewer did not confirm: the simplifier's on-disk edit is still in place, but we never proved behavior was preserved.
  // Surface these explicitly so the user knows to inspect them — otherwise the working tree silently diverges from the report.
  const unverified = pairs
    .filter(({ v }) => v.preserved !== true && !v.reverted)
    .map(({ s, v }) => ({ file: s.file, summary: s.summary, reason: v.reason || 'reviewer did not confirm preservation' }))
  return {
    changedFiles: survived.map((s) => s.file),
    reverted,
    unverified,
    summaries: survived.map((s) => `${s.file}: ${s.summary}`),
  }
}

// The gate agent inherits the orchestrator's cwd, not WORKTREE, so a relative
// command would test a different tree. Pin it to WORKTREE in the prompt, then
// check the reported cwd here: a gate that did not run, or ran elsewhere, fails.
const stripSlash = (p) => (p || '').trim().replace(/\/+$/, '')

function gatePrompt() {
  const where = WORKTREE
    ? `Run it from ${WORKTREE}: in one shell call, \`cd "${WORKTREE}" && pwd && ${GATE.command}\`. Never run it from any other directory. If that directory or anything the command needs is missing there, do not look elsewhere: return ran=false with the reason.`
    : 'Run it from your current directory.'
  return `Run the project gate and report pass/fail. Command: \`${GATE.command}\`. ${where} Return ran (false if the command could not start or a file it needs does not exist), cwd (the directory \`pwd\` printed), passed, and a short detail (failing test/lint summary if it fails, or why it could not run).`
}

function judgeGate(g) {
  if (!g) return { passed: false, detail: 'gate run unavailable — treat as failure' }
  if (!g.ran) return { passed: false, detail: `gate could not run: ${g.detail || 'no reason given'}` }
  if (WORKTREE && stripSlash(g.cwd) !== stripSlash(WORKTREE)) {
    return { passed: false, detail: `gate ran in ${g.cwd || 'an unknown directory'}, not the worktree ${WORKTREE}; its result does not count` }
  }
  return { passed: !!g.passed, detail: g.detail || '' }
}

async function runGate() {
  if (!GATE.enabled || !GATE.command) return null
  const g = await withRetry(
    () => agent(gatePrompt(), { label: 'gate', phase: 'Review', schema: GATE_SCHEMA, ...opts('gate') }),
    () => null
  )
  return judgeGate(g)
}

async function main() {
  if (!FILES.length) return 'SIMPLIFY: no files in scope.'

  if (!FOREVER.enabled) {
    const r = await onePass(1)
    const gate = await runGate()
    return [
      `SIMPLIFY: ${r.changedFiles.length} file(s) simplified, ${r.reverted.length} reverted (behavior change), ${r.unverified.length} unverified (review failed — edits left in place).`,
      ...r.summaries.map((s) => `- ${s}`),
      r.reverted.length ? `\nReverted: ${r.reverted.join(', ')}` : '',
      r.unverified.length
        ? `\nUnverified (manual inspection required):\n${r.unverified.map((u) => `- ${u.file}: ${u.summary} [${u.reason}]`).join('\n')}`
        : '',
      gate ? `\nGate (${GATE.command}): ${gate.passed ? 'PASS' : 'FAIL — ' + gate.detail}` : '',
    ].filter(Boolean).join('\n')
  }

  // forever: loop until a pass makes no surviving change, or oscillation
  const seen = new Set()
  const history = []
  const unverifiedAcc = []
  for (let p = 1; p <= CAP; p++) {
    const r = await onePass(p)
    history.push({ pass: p, changed: r.changedFiles.length, reverted: r.reverted.length, unverified: r.unverified.length })
    if (r.unverified.length) unverifiedAcc.push({ pass: p, items: r.unverified })
    log(`pass ${p}: ${r.changedFiles.length} changed, ${r.reverted.length} reverted, ${r.unverified.length} unverified`)
    if (!r.changedFiles.length) {
      const gate = await runGate()
      return foreverReport(p, history, [], unverifiedAcc, gate) + '\nConverged: a full pass produced no surviving change.'
    }
    // File-set fingerprint only — summary text is free-form LLM output and would mask real cycles.
    const fp = [...r.changedFiles].sort().join('|')
    if (seen.has(fp)) {
      const gate = await runGate()
      return foreverReport(p, history, r.changedFiles, unverifiedAcc, gate) +
        `\nSTALLED — oscillating changes on: ${r.changedFiles.join(', ')}. Conflicting simplification targets — requires manual decision.`
    }
    seen.add(fp)
  }
  const gate = await runGate()
  return foreverReport(CAP, history, [], unverifiedAcc, gate) + `\nHit hard cap of ${CAP} passes.`
}

function foreverReport(passes, history, stalled, unverifiedAcc, gate) {
  return [
    'SIMPLIFY FOREVER COMPLETE',
    `PASSES: ${passes}`,
    ...history.map((h) => `- Pass ${h.pass}: ${h.changed} simplified, ${h.reverted} reverted, ${h.unverified} unverified`),
    unverifiedAcc && unverifiedAcc.length
      ? `\nUnverified edits (manual inspection required):\n${unverifiedAcc
          .flatMap(({ pass, items }) => items.map((u) => `- [pass ${pass}] ${u.file}: ${u.summary} [${u.reason}]`))
          .join('\n')}`
      : '',
    gate ? `Gate (${GATE.command}): ${gate.passed ? 'PASS' : 'FAIL — ' + gate.detail}` : '',
  ].filter(Boolean).join('\n')
}

return await main()
