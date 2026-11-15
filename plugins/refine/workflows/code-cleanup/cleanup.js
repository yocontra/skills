export const meta = {
  name: 'code-cleanup',
  description: '12-axis parallel codebase audit (bugs, perf, security, architecture, abstractions, error-handling, api-surface, concurrency, dependencies, testing, configuration, docs) → triage → parallel fixes → optional forever loop.',
  phases: [
    { title: 'Audit', detail: '12 parallel audit agents scan the scope' },
    { title: 'Triage', detail: 'dedup, discard junk, assign P0-P3' },
    { title: 'Fix', detail: 'up to 12 parallel agents apply proper fixes' },
  ],
}

/* ─── Operations ─────────────────────────────────────────
 * Phases (per cycle):
 *   Audit  → AXES.length parallel agents (default 12, one per axis key in
 *            A.axes; prompt loaded from ${PROMPTS}/audit-<key>.md). Pure read.
 *   Triage → 1 agent. Reads ${PROMPTS}/triage.md, dedups, drops junk,
 *            assigns P0–P3. Pure read. Skipped tail-side if Audit returned 0.
 *   Fix    → up to 12 parallel agents (proximity-batched by file). Reads
 *            ${PROMPTS}/fix.md. WRITES to disk — edits files in place across
 *            the resolved scope. Skipped if Triage yields 0 issues.
 *
 * Total fan-out: ~13 agents/cycle (12 audit + 1 triage) up to ~25 agents/cycle
 * (+12 fix). Forever mode loops cycles until clean / stalled / cap (FOREVER.cap,
 * default 10) → worst case ≈ 250 agent calls. Single-shot mode is one cycle.
 *
 * Smoke-test args (fast read-only run, no fixes — drop the Fix phase by giving
 * the audit nothing actionable; or just run on a tiny scope):
 *   {
 *     promptsDir: "<plugin>/workflows/code-cleanup/prompts",
 *     axes: ["bugs"],                   // 1 axis instead of 12
 *     scope: { rootDescription: "fixtures/tiny", files: ["fixtures/tiny/a.js"] },
 *     forever: { enabled: false }
 *   }
 *
 * Scope-limit knobs (bound runtime):
 *   - A.auditModel        — model for the audit fleet (omit = session model)
 *   - A.fixModel          — model for the fix fleet (omit = session model)
 *   - A.auditEffort       — effort for the audit fleet (default medium)
 *   - A.fixEffort         — effort for the fix fleet (default medium; triage is low)
 *   - A.axes              — drop axes to shrink Audit fan-out (12 → N)
 *   - A.scope.files       — restrict to a file list vs. whole project
 *   - A.forever.enabled   — false = single cycle; true = loop
 *   - A.forever.cap       — hard cycle ceiling (default 10)
 *   - A.backupDir         — outside git: fix agents copy each file here
 *                           before their first edit, so it can be restored
 *   - (No dryRun flag — Fix always writes. To preview, run with axes=[] or a
 *     scope of one file, or use the SKILL.md prose pipeline.)
 *
 * Mutating phases: ONLY Fix writes (edits files in A.scope in place).
 * Audit + Triage are read-only.
 *
 * Common failure modes:
 *   - Schema validation on audit-<axis> agents → caught by withRetry (1 retry,
 *     then axis is logged in coverageGaps and contributes 0 findings.
 *   - Triage agent fails twice → fallback marks every raw finding P3 (noisy).
 *   - Fix batch fails twice → its IDs are reported unfixed; no retry beyond 2.
 *   - Missing ${PROMPTS}/audit-<key>.md → axis returns empty, axis name appears
 *     in COVERAGE_GAPS line of the report. Check A.promptsDir resolution.
 *   - Forever stall: identical fingerprint across cycles → returns early with
 *     "STALLED" tail. Inspect those issues by hand.
 *
 * Quick check-in: shared/workflows/OPERATIONS.md has recipes for locating the
 *   run's journal.jsonl and reading finished agents' results cheaply.
 *
 * Note: this workflow does NOT use shared/workflows/adversarial-audit.js — it's
 * flat agent() calls only. The four host skills that DO symlink that engine are
 * audit:bugs, audit:performance, audit:security, refine:freshen-docs; their
 * domain prompts live at ${PROMPTS_DIR}/<role>.md inside each host skill.
 *
 * See shared/workflows/OPERATIONS.md for general observability/management.
 * ─────────────────────────────────────────────────────── */

// code-cleanup orchestrator. Domain config (the 12 axis prompts + triage/fix
// prompts) and resolved scope arrive via `args` from the SKILL.md launcher.
// All 12 axes run as agent() calls (flat — no nested workflow()), so this stays
// well within the one-level nesting budget. The bug/perf/security/docs axes run
// a focused single-pass audit here; the full adversarial trio remains available
// by invoking those skills directly.
//
// No filesystem/Node API. No RNG/Date. Up to 16 concurrent agents.

const A = (typeof args === 'object' && args) ? args : {}
const PROMPTS = A.promptsDir
const AXES = A.axes || []
const SCOPE = A.scope || { rootDescription: '.', files: [] }
const WORKTREE = A.worktree || null
const FOREVER = A.forever || { enabled: false }
const CAP = FOREVER.cap || 10
const BACKUP_DIR = A.backupDir ? A.backupDir.replace(/\/+$/, '') : null

// Per-fleet model and effort overrides. Omitted model = inherit the session
// model. The audit and fix fleets dominate the bill (12 agents each, each paying
// a full system prompt), so these are the knobs that actually move a cycle's
// cost. Try lowering effort before switching to a weaker model.
const AUDIT_OPTS = { effort: A.auditEffort || 'medium', ...(A.auditModel ? { model: A.auditModel } : {}) }
const FIX_OPTS = { effort: A.fixEffort || 'medium', ...(A.fixModel ? { model: A.fixModel } : {}) }

function anchor(p) {
  if (!WORKTREE) return p
  if (p.startsWith('/')) return p
  return WORKTREE.replace(/\/+$/, '') + '/' + p.replace(/^\/+/, '')
}

const ANCHORED_FILES = (SCOPE.files || []).map(anchor)

const scopeText = ANCHORED_FILES.length
  ? `Files in scope:\n${ANCHORED_FILES.join('\n')}`
  : `Whole project at ${WORKTREE || SCOPE.rootDescription}.`

const WORKTREE_PIN = WORKTREE
  ? `

WORKTREE PIN — STRICT:
- WORKTREE: ${WORKTREE}
- All FILE paths above are absolute under WORKTREE.
- Every Edit/Write you do MUST target a path under ${WORKTREE}. Refuse to touch anything outside it.
- Every \`git\` command MUST be \`git -C ${WORKTREE} ...\` (or run with cwd set to WORKTREE).
- Do not \`cd\` out of the worktree. Do not edit files in any sibling repo.`
  : ''

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'file', 'class', 'impact'],
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'string' },
          class: { type: 'string' },
          impact: { type: 'string' },
          evidence: { type: 'string' },
          suggestedFix: { type: 'string' },
        },
      },
    },
  },
}

const TRIAGE_SCHEMA = {
  type: 'object',
  required: ['issues'],
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'file', 'priority', 'suggestedFix'],
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'string' },
          class: { type: 'string' },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          impact: { type: 'string' },
          suggestedFix: { type: 'string' },
        },
      },
    },
  },
}

const FIX_SCHEMA = {
  type: 'object',
  required: ['fixed', 'unfixed'],
  properties: {
    fixed: { type: 'array', items: { type: 'string' } },
    unfixed: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

// agent() resolves to null when the user skips an agent or it dies on a
// terminal API error, so a null result counts as a failure too.
const attempt = async (thunk) => {
  const r = await thunk()
  if (r == null) throw new Error('agent returned no result')
  return r
}
const withRetry = async (thunk, onFail) => {
  try { return await attempt(thunk) } catch { try { return await attempt(thunk) } catch { return onFail() } }
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const issueKey = (i) => `${i.file || ''}:${(i.title || '').toLowerCase()}`
const fingerprint = (issues) => issues.map(issueKey).sort().join('|')

async function runCycle(n) {
  // ---- Phase 1: 12 parallel audit axes ----
  phase('Audit')
  const coverageGaps = []
  const audits = await parallel(
    AXES.map((axis, i) => () =>
      withRetry(
        () => agent(
          `Read ${PROMPTS}/audit-${axis}.md for the full audit protocol for the ${axis} axis, then apply it to the scope below.

SCOPE: ${scopeText}${WORKTREE_PIN}

Return at most 15 findings, highest impact first, in the structured schema; keep evidence to the 1-3 lines that show the problem and each other field to one sentence. If nothing found, return an empty findings array.`,
          { label: `audit:${axis}`, phase: 'Audit', schema: FINDINGS_SCHEMA, ...AUDIT_OPTS }
        ),
        () => { coverageGaps.push(axis); return { findings: [] } }
      )
    )
  )
  // map over the original (index-aligned) audits array so axis labels stay
  // bound to the right pass even if a slot is null; skip null slots inline.
  const all = audits.flatMap((a, i) =>
    a ? (a.findings || []).map((f) => ({ ...f, axis: AXES[i] || 'unknown' })) : []
  )
  if (!all.length) {
    return { report: `CYCLE: ${n}\nFOUND: 0 issues\nFIXED: 0\nREMAINING: 0\n${coverageGaps.length ? 'COVERAGE_GAPS: ' + coverageGaps.join(', ') : ''}`, issues: [], fixedCount: 0 }
  }

  // ---- Phase 2: triage (dedup, discard junk, prioritize) ----
  phase('Triage')
  const triaged = await withRetry(
    () => agent(
      `Read ${PROMPTS}/triage.md for the full triage protocol, then apply it to the findings below.

FINDINGS (JSON, from 12 audit axes):
${JSON.stringify(all, null, 2)}

Return the deduplicated, prioritized issue list in the structured schema.`,
      { label: 'triage', phase: 'Triage', schema: TRIAGE_SCHEMA, effort: 'low' }
    ),
    () => ({ issues: all.map((f) => ({ ...f, priority: 'P3' })) })
  )
  const issues = (triaged.issues || []).map((it, i) => ({ ...it, id: `FIX-${String(i + 1).padStart(3, '0')}` }))
  if (!issues.length) {
    return { report: `CYCLE: ${n}\nFOUND: ${all.length} raw, 0 after triage\nFIXED: 0\nREMAINING: 0`, issues: [], fixedCount: 0 }
  }

  // ---- Phase 3: fix (proximity-batched, up to 12 parallel) ----
  phase('Fix')
  const anchoredIssues = issues.map((it) => ({ ...it, file: anchor(it.file) }))
  const byFile = {}
  for (const it of anchoredIssues) (byFile[it.file] = byFile[it.file] || []).push(it)
  const groups = Object.values(byFile)
  const batches = chunk(groups, Math.max(1, Math.ceil(groups.length / 12))).map((g) => g.flat())
  const fixes = await parallel(
    batches.map((b, i) => () =>
      withRetry(
        () => agent(
          `Read ${PROMPTS}/fix.md for the full fix-agent protocol, then resolve the issues in your batch.

ISSUES (JSON):
${JSON.stringify(b, null, 2)}${WORKTREE_PIN}

Edit the files in place.${BACKUP_DIR ? ` Before your first edit of a file, copy it into ${BACKUP_DIR}/cycle-${n}/ with its path flattened (\`/\` → \`__\`), so it can be restored.` : ''} Leave only intended edits: no scratch files, backups in the repo, stashes, branches, or commits. Return the structured result with fixed/unfixed IDs and a summary of at most 40 words.`,
          { label: `fix:${i + 1}`, phase: 'Fix', schema: FIX_SCHEMA, ...FIX_OPTS }
        ),
        () => ({ fixed: [], unfixed: b.map((x) => x.id), summary: 'fix batch unavailable' })
      )
    )
  )
  // Count against the triaged ids: an id a fix agent left out of both lists is
  // still unfixed, and an id it made up is not a fix.
  const issueIds = new Set(issues.map((it) => it.id))
  const fixedSet = new Set(fixes.filter(Boolean).flatMap((f) => f.fixed || []).filter((id) => issueIds.has(id)))
  const fixedIds = [...fixedSet]
  const unfixedIds = issues.map((it) => it.id).filter((id) => !fixedSet.has(id))
  const counts = issues.reduce((acc, it) => { acc[it.priority] = (acc[it.priority] || 0) + 1; return acc }, {})
  const PRANK = { P0: 0, P1: 1, P2: 2, P3: 3 }
  const detail = [...issues]
    .sort((a, b) => (PRANK[a.priority] ?? 4) - (PRANK[b.priority] ?? 4))
    .map((it) => `- [${it.priority}] ${fixedSet.has(it.id) ? 'FIXED' : 'UNFIXED'} | ${it.file}${it.line ? ':' + it.line : ''} — ${it.title}${it.suggestedFix ? ` (fix: ${String(it.suggestedFix).replace(/\s+/g, ' ').slice(0, 90)})` : ''}`)
    .join('\n')
  const report =
    `CYCLE: ${n}\n` +
    `FOUND: ${issues.length} issues (${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')})\n` +
    `FIXED: ${fixedIds.length}\n` +
    `REMAINING: ${unfixedIds.length} (requires manual intervention)` +
    (coverageGaps.length ? `\nCOVERAGE_GAPS: ${coverageGaps.join(', ')}` : '') +
    `\n\n## Issues\n${detail}`
  return { report, issues, fixedCount: fixedIds.length }
}

async function main() {
  if (!FOREVER.enabled) {
    const { report } = await runCycle(1)
    return report
  }
  let prev = null
  const history = []
  let totalFound = 0
  let totalFixed = 0
  for (let c = 1; c <= CAP; c++) {
    const { report, issues, fixedCount } = await runCycle(c)
    history.push({ cycle: c, found: issues.length, fixed: fixedCount })
    totalFound += issues.length
    totalFixed += fixedCount
    log(`cycle ${c}: found ${issues.length}, fixed ${fixedCount}`)
    if (!issues.length) {
      return foreverReport(c, totalFound, totalFixed, 0, history) + `\n\nLAST:\n${report}`
    }
    const fp = fingerprint(issues)
    if (fp === prev) {
      return foreverReport(c, totalFound, totalFixed, issues.length, history) +
        `\n\nSTALLED — ${issues.length} issue(s) keep recurring; requires manual intervention.`
    }
    prev = fp
  }
  return foreverReport(CAP, totalFound, totalFixed, null, history) + `\n\nHit hard cap of ${CAP} cycles.`
}

function foreverReport(cycles, found, fixed, remaining, history) {
  return [
    'FOREVER MODE COMPLETE',
    `CYCLES: ${cycles}`,
    `TOTAL_FOUND: ${found} issues across all cycles`,
    `TOTAL_FIXED: ${fixed} issues`,
    remaining == null ? '' : `REMAINING: ${remaining}`,
    '',
    'CYCLE BREAKDOWN:',
    ...history.map((h) => `- Cycle ${h.cycle}: found ${h.found}, fixed ${h.fixed}`),
  ].filter((l) => l !== '').join('\n')
}

return await main()
