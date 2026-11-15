// shared/workflows/adversarial-audit.test.mjs — verification harness for the
// shared adversarial-audit engine.
//
// Why this exists: the engine is loaded by the workflow runtime as an
// `AsyncFunction(body)` with a fixed set of ambient globals (`agent`,
// `parallel`, `phase`, `log`, `args`, …) and no module system. No
// natural way to import its helpers, so this harness:
//
//   1. reads `adversarial-audit.js` from disk,
//   2. rewrites the trailing `return await main()` to instead expose an
//      internal test surface (the helper functions and `runCycle`/`main`),
//   3. compiles the rewritten body as an `AsyncFunction` matching the
//      runtime signature, and
//   4. drives it with stubbed `agent` / `parallel` / `phase` / `log`
//      shims plus a controlled `args` object.
//
// The orchestrator's stub returns canned hunter / skeptic / referee outputs
// keyed off the agent label, so each test exercises the full Recon → Hunt →
// Dedup → Skeptic → Referee pipeline against deterministic inputs and
// asserts on `verdictBlock` text + survivor lists.
//
// Run: `node --test shared/workflows/__tests__/adversarial-audit.test.mjs`

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENGINE = resolve(HERE, '..', 'adversarial-audit.js')
const SRC = readFileSync(ENGINE, 'utf8')

// Rewrite the engine's trailing `return await main()` so that — only inside
// this harness — we expose internals to the test. Production loading is
// untouched (the runtime still sees the on-disk file). The engine ends with
// exactly one such return; the regex anchors at end-of-file.
const TEST_TAIL = `
return {
  main,
  runCycle,
  helpers: {
    partitionFiles,
    zoneCount,
    finderPlan,
    chunk,
    findingKey,
    fingerprint,
    bySeverity,
    verdictBlock,
    findingDetail,
    killedTable,
  },
}
`
// Strip the `export` keyword so the body compiles as an AsyncFunction body
// (matches what check-workflows.mjs does for its syntax check), then splice
// in the exposure tail for testing.
const STRIPPED = SRC.replace(/^export\s+const\s+meta/m, 'const meta')
if (STRIPPED === SRC) {
  throw new Error('test harness: failed to strip `export` from meta; engine layout changed')
}
const TESTABLE = STRIPPED.replace(/return\s+await\s+main\s*\(\s*\)\s*$/m, TEST_TAIL.trim())
if (TESTABLE === STRIPPED) {
  throw new Error('test harness: failed to splice exposure tail; engine layout changed')
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

/**
 * Build a fresh engine instance with the supplied stubs and args.
 * Each call to load() returns a brand-new closure over its own stubs so
 * tests cannot leak state between cases.
 */
async function load({ args = {}, agentImpl, parallelImpl, phaseImpl, logImpl } = {}) {
  const fn = new AsyncFunction(
    'agent',
    'parallel',
    'pipeline',
    'log',
    'phase',
    'args',
    'budget',
    'workflow',
    TESTABLE,
  )
  const calls = { agent: [], phase: [], log: [] }
  const agentStub =
    agentImpl ||
    (async () => {
      throw new Error('no agent stub provided for this test')
    })
  const parallelStub =
    parallelImpl ||
    (async (thunks) => Promise.all(thunks.map((t) => t())))
  const phaseStub = (name) => {
    calls.phase.push(name)
    if (phaseImpl) phaseImpl(name)
  }
  const logStub = (msg) => {
    calls.log.push(msg)
    if (logImpl) logImpl(msg)
  }
  const tracedAgent = async (prompt, opts) => {
    calls.agent.push({ prompt, opts })
    return agentImpl(prompt, opts)
  }
  const exposed = await fn(
    agentImpl ? tracedAgent : agentStub,
    parallelStub,
    () => {},
    logStub,
    phaseStub,
    args,
    {},
    {},
  )
  return { ...exposed, calls }
}

// --------------------------------------------------------------------------
// helper-function tests (pure, deterministic — no agent calls)
// --------------------------------------------------------------------------

test('partitionFiles: round-robin assigns files into n zones, drops empties', async () => {
  const { helpers } = await load()
  const zones = helpers.partitionFiles(['a', 'b', 'c', 'd', 'e'], 3)
  assert.deepEqual(zones, [['a', 'd'], ['b', 'e'], ['c']])
})

test('partitionFiles: empty zones are filtered when files < n', async () => {
  const { helpers } = await load()
  const zones = helpers.partitionFiles(['a', 'b'], 5)
  // index-stride: 0->z0, 1->z1, others empty -> filtered
  assert.deepEqual(zones, [['a'], ['b']])
})

test('zoneCount: respects constrained, file-count tiers, and MAX_ZONES', async () => {
  const { helpers } = await load({ args: { partition: { maxZones: 4 } } })
  assert.equal(helpers.zoneCount(50, true), 2, 'constrained -> min(2, MAX_ZONES)')
  assert.equal(helpers.zoneCount(10, false), 3, 'small <20 -> 3')
  assert.equal(helpers.zoneCount(50, false), 4, 'mid (5) capped at MAX_ZONES=4')
  assert.equal(helpers.zoneCount(500, false), 4, 'large (6) capped at MAX_ZONES=4')
  assert.equal(helpers.zoneCount(1, false), 1, 'never exceeds file count')
  assert.equal(helpers.zoneCount(5, false), 1, 'fewer than 6 files -> one zone')
  assert.equal(helpers.zoneCount(5, true), 1, 'fewer than 6 files -> one zone, even constrained')
})

test('finderPlan: null when no scaling configured', async () => {
  const { helpers } = await load()
  assert.equal(helpers.finderPlan(50), null)
})

test('finderPlan: returns first matching tier, falls through to last for overflow', async () => {
  const { helpers } = await load({
    args: {
      finderScaling: [
        { maxFiles: 10, finders: 2 },
        { maxFiles: 50, finders: 4 },
        { maxFiles: 200, finders: 8, mode: 'two-pass' },
      ],
    },
  })
  assert.deepEqual(helpers.finderPlan(5), { finders: 2, mode: 'direct' })
  assert.deepEqual(helpers.finderPlan(40), { finders: 4, mode: 'direct' })
  assert.deepEqual(helpers.finderPlan(150), { finders: 8, mode: 'two-pass' })
  // overflow -> fall through to last entry
  assert.deepEqual(helpers.finderPlan(9999), { finders: 8, mode: 'two-pass' })
})

test('bySeverity: orders Critical < High < Medium < Low, conditional after confirmed at same severity', async () => {
  const { helpers } = await load({ args: { conditionalVerdict: 'CONDITIONAL' } })
  const items = [
    { id: 'a', severity: 'Low', verdict: 'CONFIRMED' },
    { id: 'b', severity: 'Critical', verdict: 'CONFIRMED' },
    { id: 'c', severity: 'High', verdict: 'CONDITIONAL' },
    { id: 'd', severity: 'High', verdict: 'CONFIRMED' },
    { id: 'e', severity: 'Medium', verdict: 'CONFIRMED' },
  ]
  const sorted = [...items].sort(helpers.bySeverity)
  assert.deepEqual(
    sorted.map((s) => s.id),
    ['b', 'd', 'c', 'e', 'a'],
  )
})

test('findingKey + fingerprint: stable, order-independent', async () => {
  const { helpers } = await load()
  const a = [
    { file: 'x.js', line: '10', title: 'Boom' },
    { file: 'y.js', line: '5', title: 'Bang' },
  ]
  const b = [
    { file: 'y.js', line: '5', title: 'Bang' },
    { file: 'x.js', line: '10', title: 'Boom' },
  ]
  assert.equal(helpers.fingerprint(a), helpers.fingerprint(b))
  // distinct findings -> distinct fingerprint
  const c = [{ file: 'x.js', line: '10', title: 'Different' }]
  assert.notEqual(helpers.fingerprint(a), helpers.fingerprint(c))
})

test('chunk: splits into batches of given size', async () => {
  const { helpers } = await load()
  assert.deepEqual(helpers.chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  assert.deepEqual(helpers.chunk([], 4), [])
})

test('verdictBlock: clean run prints CLEAN with scope + zones', async () => {
  const { helpers } = await load()
  const block = helpers.verdictBlock([], { scopeFiles: 12, count: 0 }, [], [], 3)
  assert.match(block, /^VERDICT: CLEAN/)
  assert.match(block, /SCOPE: 12 files/)
  assert.match(block, /ZONES: 3 zones, 0 findings submitted/)
})

test('verdictBlock: clean run still surfaces killed table when present', async () => {
  const { helpers } = await load()
  const killed = [
    { id: 'BUG-001', title: 'False positive | with pipe', verdict: 'NOT_A_BUG', reasoning: 'guarded by null check' },
  ]
  const block = helpers.verdictBlock([], { scopeFiles: 1, count: 1 }, killed, [], 1)
  assert.match(block, /## Killed Findings \(1\)/)
  // pipe should be escaped in the markdown table
  assert.match(block, /False positive \\\| with pipe/)
})

test('verdictBlock: ISSUES_FOUND lists confirmed before conditional and renders detail', async () => {
  const { helpers } = await load({ args: { conditionalVerdict: 'CONDITIONAL' } })
  const survivors = [
    {
      id: 'BUG-001',
      title: 'NPE in handler',
      severity: 'High',
      file: 'src/a.js',
      line: '10',
      class: 'logic',
      verdict: 'CONFIRMED',
      suggestedFix: 'Add null guard before accessing user.name. Then revalidate.',
    },
    {
      id: 'BUG-002',
      title: 'Maybe leak',
      severity: 'Medium',
      file: 'src/b.js',
      line: '20',
      class: 'memory',
      verdict: 'CONDITIONAL',
      conditions: 'only under load',
      suggestedFix: 'Investigate.',
    },
  ]
  const block = helpers.verdictBlock(survivors, { scopeFiles: 5, count: 2 }, [], [], 2)
  assert.match(block, /^VERDICT: ISSUES_FOUND/)
  assert.match(block, /ISSUE_COUNT: 1 confirmed, 1 conditional/)
  assert.match(block, /## Confirmed Issues/)
  assert.match(block, /## Conditional Issues/)
  // confirmed appears before conditional in the file
  const confirmedIdx = block.indexOf('## Confirmed Issues')
  const conditionalIdx = block.indexOf('## Conditional Issues')
  assert.ok(confirmedIdx >= 0 && conditionalIdx > confirmedIdx)
  // teaser truncates correctly: keeps first sentence
  assert.match(block, /FIX: Add null guard before accessing user\.name …/)
  assert.match(block, /CONDITIONAL/)
})

test('verdictBlock: surfaces coverage gaps section', async () => {
  const { helpers } = await load()
  const block = helpers.verdictBlock([], { scopeFiles: 5, count: 0 }, [], ['zone 2 (3 files)'], 5)
  assert.match(block, /COVERAGE_GAPS: zone 2 \(3 files\)/)
})

// --------------------------------------------------------------------------
// pipeline tests (drive runCycle end-to-end with stubbed agents)
// --------------------------------------------------------------------------

/**
 * Build an `agent` stub that dispatches by `opts.label`. Each label maps to a
 * function returning the canned response. Unknown labels throw so a test
 * notices when the pipeline grows a new step.
 */
function dispatcherAgent(handlers) {
  return async (_prompt, opts) => {
    const label = opts && opts.label
    for (const key of Object.keys(handlers)) {
      // exact match or prefix match (handles "hunt:1", "skeptic:2", "referee:3")
      if (label === key || label.startsWith(key)) {
        return handlers[key](opts)
      }
    }
    throw new Error(`dispatcherAgent: no handler for label "${label}"`)
  }
}

const baseArgs = {
  domainLabel: 'bug',
  idPrefix: 'BUG',
  promptsDir: '/tmp/prompts',
  scope: { rootDescription: '.', files: ['src/a.js', 'src/b.js'] },
  verdictEnum: ['CONFIRMED', 'NOT_A_BUG', 'CONDITIONAL'],
  confirmVerdicts: ['CONFIRMED', 'CONDITIONAL'],
  conditionalVerdict: 'CONDITIONAL',
  partition: { maxZones: 6 },
}

test('runCycle: clean — recon empty file list short-circuits with CLEAN', async () => {
  const { runCycle } = await load({
    args: { ...baseArgs, scope: { rootDescription: '.' } },
    agentImpl: dispatcherAgent({
      recon: () => ({ summary: 'empty', files: [] }),
    }),
  })
  const out = await runCycle(0)
  assert.deepEqual(out.survivors, [])
  assert.match(out.block, /VERDICT: CLEAN/)
  assert.match(out.block, /SCOPE: 0 files/)
})

test('runCycle: hunters return nothing -> CLEAN with non-zero scope', async () => {
  const { runCycle } = await load({
    args: baseArgs,
    agentImpl: dispatcherAgent({
      recon: () => ({ summary: 's', files: baseArgs.scope.files }),
      hunt: () => ({ findings: [] }),
    }),
  })
  const out = await runCycle(0)
  assert.match(out.block, /VERDICT: CLEAN/)
  assert.match(out.block, /SCOPE: 2 files/)
})

test('runCycle: full pipeline assembles survivors and ranks killed/coverage correctly', async () => {
  const handlers = {
    recon: () => ({ summary: 'recon', files: baseArgs.scope.files }),
    hunt: () => ({
      findings: [
        { title: 'Crash on null', file: 'src/a.js', line: '12', class: 'logic', impact: 'crash' },
        { title: 'Off by one', file: 'src/b.js', line: '34', class: 'logic', impact: 'wrong result' },
      ],
    }),
    dedup: () => ({
      findings: [
        { title: 'Crash on null', file: 'src/a.js', line: '12', class: 'logic', impact: 'crash' },
        { title: 'Off by one', file: 'src/b.js', line: '34', class: 'logic', impact: 'wrong result' },
      ],
    }),
    skeptic: () => ({
      verdicts: [
        { findingRef: 'BUG-001', verdict: 'SURVIVED' },
        { findingRef: 'BUG-002', verdict: 'KILLED', evidence: 'guarded' },
      ],
    }),
    referee: () => ({
      judgments: [
        {
          findingRef: 'BUG-001',
          verdict: 'CONFIRMED',
          severity: 'High',
          reasoning: 'real bug',
          suggestedFix: 'add null guard',
        },
        {
          findingRef: 'BUG-002',
          verdict: 'NOT_A_BUG',
          severity: 'Low',
          reasoning: 'guarded by length check',
        },
      ],
    }),
  }
  const { runCycle } = await load({ args: baseArgs, agentImpl: dispatcherAgent(handlers) })
  const out = await runCycle(0)
  assert.equal(out.survivors.length, 1)
  assert.equal(out.survivors[0].id, 'BUG-001')
  assert.match(out.block, /VERDICT: ISSUES_FOUND/)
  assert.match(out.block, /\[BUG-001\] SEVERITY: High \| FILE: src\/a\.js:12/)
  // killed list surfaces the rejected finding
  assert.match(out.block, /## Killed Findings \(1\)/)
  assert.match(out.block, /BUG-002/)
  // confirmed section detail
  assert.match(out.block, /## Confirmed Issues/)
  assert.match(out.block, /add null guard/)
})

test('runCycle: cveGrounding downgrades unverified dependency findings to CONDITIONAL', async () => {
  const handlers = {
    recon: () => ({ summary: 'r', files: ['package.json'] }),
    hunt: () => ({
      findings: [
        {
          title: 'CVE-2024-12345 in left-pad',
          file: 'package.json',
          line: '5',
          class: 'dependency',
          type: 'dependency',
          impact: 'rce',
          cve: 'CVE-2024-12345',
          confidence: 'high', // NOT tool-verified
        },
        {
          title: 'CVE-2024-99999 in lodash',
          file: 'package.json',
          line: '7',
          class: 'dependency',
          type: 'dependency',
          impact: 'proto pollution',
          cve: 'CVE-2024-99999',
          confidence: 'tool-verified osv-scanner',
        },
      ],
    }),
    dedup: ({}) => ({
      findings: [
        {
          title: 'CVE-2024-12345 in left-pad',
          file: 'package.json',
          line: '5',
          class: 'dependency',
          type: 'dependency',
          impact: 'rce',
          cve: 'CVE-2024-12345',
          confidence: 'high',
        },
        {
          title: 'CVE-2024-99999 in lodash',
          file: 'package.json',
          line: '7',
          class: 'dependency',
          type: 'dependency',
          impact: 'proto pollution',
          cve: 'CVE-2024-99999',
          confidence: 'tool-verified osv-scanner',
        },
      ],
    }),
    skeptic: () => ({
      verdicts: [
        { findingRef: 'VULN-001', verdict: 'SURVIVED' },
        { findingRef: 'VULN-002', verdict: 'SURVIVED' },
      ],
    }),
    referee: () => ({
      judgments: [
        {
          findingRef: 'VULN-001',
          verdict: 'CONFIRMED',
          severity: 'Critical',
          reasoning: 'critical',
          suggestedFix: 'upgrade',
        },
        {
          findingRef: 'VULN-002',
          verdict: 'CONFIRMED',
          severity: 'High',
          reasoning: 'real',
          suggestedFix: 'upgrade',
          confidence: 'tool-verified',
        },
      ],
    }),
  }
  const { runCycle } = await load({
    args: {
      ...baseArgs,
      idPrefix: 'VULN',
      cveGrounding: true,
      findingFields: ['cve', 'confidence', 'type'],
      confidenceField: true,
      scope: { rootDescription: '.', files: ['package.json'] },
    },
    agentImpl: dispatcherAgent(handlers),
  })
  const out = await runCycle(0)
  // both survive (CONFIRMED + CONDITIONAL both pass CONFIRM filter)
  assert.equal(out.survivors.length, 2)
  const byId = new Map(out.survivors.map((s) => [s.id, s]))
  assert.equal(byId.get('VULN-001').verdict, 'CONDITIONAL', 'unverified dep CVE downgraded')
  assert.match(byId.get('VULN-001').conditions || '', /CVE not tool-verified/)
  assert.equal(byId.get('VULN-002').verdict, 'CONFIRMED', 'tool-verified dep CVE preserved')
})

test('runCycle: UNREVIEWED judgments surface as a coverage gap, not a kill', async () => {
  // A flaky referee batch double-fails -> withRetry returns the fallback
  // judgment with verdict "UNREVIEWED". The engine MUST surface that as a
  // coverage gap rather than silently dropping or marking it killed.
  let refereeCalls = 0
  const handlers = {
    recon: () => ({ summary: 'r', files: baseArgs.scope.files }),
    hunt: () => ({
      findings: [
        { title: 'Bug A', file: 'src/a.js', line: '1', class: 'logic', impact: 'x' },
      ],
    }),
    dedup: () => ({
      findings: [
        { title: 'Bug A', file: 'src/a.js', line: '1', class: 'logic', impact: 'x' },
      ],
    }),
    skeptic: () => ({ verdicts: [{ findingRef: 'BUG-001', verdict: 'SURVIVED' }] }),
    referee: () => {
      refereeCalls += 1
      throw new Error('flaky referee')
    },
  }
  const { runCycle } = await load({ args: baseArgs, agentImpl: dispatcherAgent(handlers) })
  const out = await runCycle(0)
  assert.ok(refereeCalls >= 2, 'referee was retried at least once')
  assert.equal(out.survivors.length, 0, 'UNREVIEWED is not a survivor')
  // No survivors -> the engine takes the CLEAN path which formats coverage
  // gaps as a one-line "COVERAGE_GAPS: ..." rather than the "## Coverage
  // Gaps" multi-line section. Either form is acceptable; assert content.
  assert.match(out.block, /COVERAGE_GAPS|## Coverage Gaps/)
  assert.match(out.block, /1 finding\(s\) unreviewed/)
})

test('runCycle: hunter zone failure becomes a coverage gap, pipeline continues', async () => {
  // Track per-zone retry count from the prompt so failures aren't shared
  // across concurrent zone calls. The first zone's prompt contains
  // "ZONE INDEX: 1" — fail it twice so withRetry falls back to the empty
  // findings + coverage gap path. Other zones succeed on first try.
  const failedZones = new Map()
  const handlers = {
    recon: () => ({
      summary: 'r',
      files: ['src/a.js', 'src/b.js', 'src/c.js', 'src/d.js', 'src/e.js', 'src/f.js', 'src/g.js'],
    }),
  }
  const allFiles = ['src/a.js', 'src/b.js', 'src/c.js', 'src/d.js', 'src/e.js', 'src/f.js', 'src/g.js']
  const agentImpl = async (prompt, opts) => {
    const label = opts.label
    if (label === 'recon') return { summary: 'r', files: allFiles }
    if (label.startsWith('hunt:')) {
      // Zone 1 always fails (both attempts) so withRetry yields the gap.
      const m = prompt.match(/ZONE INDEX: (\d+)/)
      const zone = m ? Number(m[1]) : 0
      if (zone === 1) {
        failedZones.set(zone, (failedZones.get(zone) || 0) + 1)
        throw new Error(`zone ${zone} hunter unavailable`)
      }
      return {
        findings: [
          { title: 'Y', file: 'src/b.js', line: '1', class: 'logic', impact: 'x' },
        ],
      }
    }
    if (label === 'dedup') {
      return { findings: [{ title: 'Y', file: 'src/b.js', line: '1', class: 'logic', impact: 'x' }] }
    }
    if (label.startsWith('skeptic:')) {
      return { verdicts: [{ findingRef: 'BUG-001', verdict: 'SURVIVED' }] }
    }
    if (label.startsWith('referee:')) {
      return {
        judgments: [
          {
            findingRef: 'BUG-001',
            verdict: 'CONFIRMED',
            severity: 'Medium',
            reasoning: 'r',
            suggestedFix: 'fix',
          },
        ],
      }
    }
    throw new Error(`unhandled label: ${label}`)
  }
  const { runCycle } = await load({
    args: {
      ...baseArgs,
      scope: { rootDescription: '.', files: allFiles },
    },
    agentImpl,
  })
  const out = await runCycle(0)
  assert.ok((failedZones.get(1) || 0) >= 2, 'zone 1 was retried before falling back')
  assert.equal(out.survivors.length, 1)
  // Survivors > 0 -> the multi-line coverage section header is used.
  assert.match(out.block, /## Coverage Gaps/)
  assert.match(out.block, /zone 1 \(\d+ files\)/)
})

test('runCycle: two-pass finder mode runs triage then narrows hunt to highRisk', async () => {
  const allFiles = Array.from({ length: 12 }, (_, i) => `src/f${i}.js`)
  const reconCalls = []
  const huntZones = []
  const handlers = {
    recon: (opts) => {
      reconCalls.push(opts.label)
      return { summary: 'r', files: allFiles }
    },
    triage: () => ({
      summary: 'triage',
      files: allFiles,
      highRisk: ['src/f0.js', 'src/f1.js'],
    }),
    hunt: (opts) => {
      huntZones.push(opts.label)
      return { findings: [] }
    },
  }
  const { runCycle } = await load({
    args: {
      ...baseArgs,
      finderScaling: [{ maxFiles: 100, finders: 4, mode: 'two-pass' }],
      scope: { rootDescription: '.', files: allFiles },
    },
    agentImpl: dispatcherAgent(handlers),
  })
  const out = await runCycle(0)
  assert.match(out.block, /VERDICT: CLEAN/)
  assert.equal(reconCalls.length, 1, 'one full recon pass')
  // two high-risk files -> at most 2 hunt zones (capped by file count)
  assert.equal(huntZones.length, 2)
})

test('runCycle: a null dedup result (skipped agent) falls back to the raw findings instead of crashing', async () => {
  let dedupCalls = 0
  const { runCycle } = await load({
    args: baseArgs,
    agentImpl: dispatcherAgent({
      recon: () => ({ summary: 'r', files: baseArgs.scope.files }),
      hunt: () => ({ findings: [{ title: 'Crash', file: 'src/a.js', line: '1', class: 'logic', impact: 'x' }] }),
      dedup: () => { dedupCalls++; return null },
      skeptic: () => ({ verdicts: [{ findingRef: 'BUG-001', verdict: 'SURVIVED' }] }),
      referee: () => ({ judgments: [{ findingRef: 'BUG-001', verdict: 'CONFIRMED', severity: 'High' }] }),
    }),
  })
  const out = await runCycle(0)
  assert.equal(dedupCalls, 2, 'a null result is retried once')
  assert.equal(out.survivors.length, 1)
  assert.match(out.block, /VERDICT: ISSUES_FOUND/)
})

test('runCycle: a null skeptic or referee result degrades to the documented fallbacks', async () => {
  const { runCycle } = await load({
    args: baseArgs,
    agentImpl: dispatcherAgent({
      recon: () => ({ summary: 'r', files: baseArgs.scope.files }),
      hunt: () => ({ findings: [{ title: 'Crash', file: 'src/a.js', line: '1', class: 'logic', impact: 'x' }] }),
      dedup: () => ({ findings: [{ title: 'Crash', file: 'src/a.js', line: '1', class: 'logic', impact: 'x' }] }),
      skeptic: () => null,
      referee: () => null,
    }),
  })
  const out = await runCycle(0)
  assert.equal(out.survivors.length, 0)
  assert.match(out.block, /1 finding\(s\) unreviewed/)
})

test('runCycle: a failed recon with no caller file list is a coverage gap, not a silent CLEAN', async () => {
  const { runCycle } = await load({
    args: { ...baseArgs, scope: { rootDescription: '.' } },
    agentImpl: dispatcherAgent({
      recon: () => { throw new Error('recon down') },
    }),
  })
  const out = await runCycle(0)
  assert.match(out.block, /VERDICT: CLEAN/)
  assert.match(out.block, /COVERAGE_GAPS: recon failed/)
})

test('runCycle: a failed two-pass triage hunts every file and records the gap', async () => {
  const allFiles = Array.from({ length: 12 }, (_, i) => `src/f${i}.js`)
  const { runCycle } = await load({
    args: {
      ...baseArgs,
      finderScaling: [{ maxFiles: 100, finders: 4, mode: 'two-pass' }],
      scope: { rootDescription: '.', files: allFiles },
    },
    agentImpl: dispatcherAgent({
      recon: () => ({ summary: 'r', files: allFiles }),
      triage: () => null,
      hunt: () => ({ findings: [] }),
    }),
  })
  const out = await runCycle(0)
  assert.match(out.block, /SCOPE: 12 files/)
  assert.match(out.block, /triage failed/)
})

// --------------------------------------------------------------------------
// main() / forever-mode tests
// --------------------------------------------------------------------------

test('main: forever mode converges clean and emits convergence note', async () => {
  let cycle = 0
  const handlers = {
    recon: () => ({ summary: 'r', files: baseArgs.scope.files }),
    hunt: () => {
      cycle += 1
      // first cycle: 1 finding; second cycle: clean
      if (cycle === 1) {
        return {
          findings: [
            { title: 'Bug A', file: 'src/a.js', line: '1', class: 'logic', impact: 'x' },
          ],
        }
      }
      return { findings: [] }
    },
    dedup: () => ({
      findings: [{ title: 'Bug A', file: 'src/a.js', line: '1', class: 'logic', impact: 'x' }],
    }),
    skeptic: () => ({ verdicts: [{ findingRef: 'BUG-001', verdict: 'SURVIVED' }] }),
    referee: () => ({
      judgments: [
        {
          findingRef: 'BUG-001',
          verdict: 'CONFIRMED',
          severity: 'High',
          reasoning: 'r',
          suggestedFix: 'fix',
        },
      ],
    }),
    fix: () => ({ fixed: ['BUG-001'] }),
  }
  const { main } = await load({
    args: { ...baseArgs, forever: { enabled: true, cap: 5 } },
    agentImpl: dispatcherAgent(handlers),
  })
  const out = await main()
  assert.match(out, /FOREVER: converged clean after 2 cycle\(s\)/)
})

test('main: forever mode detects stall when survivors are identical across cycles', async () => {
  // Same finding survives every cycle -> identical fingerprint -> STALLED.
  const handlers = {
    recon: () => ({ summary: 'r', files: baseArgs.scope.files }),
    hunt: () => ({
      findings: [
        { title: 'Stuck bug', file: 'src/a.js', line: '99', class: 'logic', impact: 'x' },
      ],
    }),
    dedup: () => ({
      findings: [{ title: 'Stuck bug', file: 'src/a.js', line: '99', class: 'logic', impact: 'x' }],
    }),
    skeptic: () => ({ verdicts: [{ findingRef: 'BUG-001', verdict: 'SURVIVED' }] }),
    referee: () => ({
      judgments: [
        {
          findingRef: 'BUG-001',
          verdict: 'CONFIRMED',
          severity: 'High',
          reasoning: 'r',
          suggestedFix: 'fix',
        },
      ],
    }),
    fix: () => ({ fixed: [] }),
  }
  const { main } = await load({
    args: { ...baseArgs, forever: { enabled: true, cap: 4 } },
    agentImpl: dispatcherAgent(handlers),
  })
  const out = await main()
  assert.match(out, /FOREVER: STALLED after 2 cycles/)
  assert.match(out, /1 finding\(s\) require manual intervention/)
})

test('main: forever mode hits hard cap and emits history JSON', async () => {
  // Different fingerprint each cycle so we never converge or stall.
  let cycle = 0
  const handlers = {
    recon: () => ({ summary: 'r', files: baseArgs.scope.files }),
    hunt: () => {
      cycle += 1
      return {
        findings: [
          {
            title: `Drift bug ${cycle}`,
            file: `src/a${cycle}.js`,
            line: String(cycle),
            class: 'logic',
            impact: 'x',
          },
        ],
      }
    },
    dedup: ({}) => ({
      findings: [
        {
          title: `Drift bug ${cycle}`,
          file: `src/a${cycle}.js`,
          line: String(cycle),
          class: 'logic',
          impact: 'x',
        },
      ],
    }),
    skeptic: () => ({ verdicts: [{ findingRef: 'BUG-001', verdict: 'SURVIVED' }] }),
    referee: () => ({
      judgments: [
        {
          findingRef: 'BUG-001',
          verdict: 'CONFIRMED',
          severity: 'High',
          reasoning: 'r',
          suggestedFix: 'fix',
        },
      ],
    }),
    fix: () => ({ fixed: [] }),
  }
  const { main } = await load({
    args: { ...baseArgs, forever: { enabled: true, cap: 2 } },
    agentImpl: dispatcherAgent(handlers),
  })
  const out = await main()
  assert.match(out, /FOREVER: hit hard cap of 2 cycles/)
  assert.match(out, /HISTORY: \[/)
  // history should record 2 cycles
  const m = out.match(/HISTORY: (\[.+\])/)
  assert.ok(m, 'history JSON present')
  const history = JSON.parse(m[1])
  assert.equal(history.length, 2)
  assert.equal(history[0].cycle, 1)
  assert.equal(history[1].cycle, 2)
})

test('main: non-forever mode returns the cycle block unchanged', async () => {
  const handlers = {
    recon: () => ({ summary: 'r', files: baseArgs.scope.files }),
    hunt: () => ({ findings: [] }),
  }
  const { main } = await load({ args: baseArgs, agentImpl: dispatcherAgent(handlers) })
  const out = await main()
  assert.match(out, /^VERDICT: CLEAN/)
  assert.doesNotMatch(out, /FOREVER:/)
})

const confirmedOneHandlers = (extra) => ({
  recon: () => ({ summary: 'r', files: baseArgs.scope.files }),
  hunt: () => ({ findings: [{ title: 'Bug A', file: 'src/a.js', line: '1', class: 'logic', impact: 'x' }] }),
  dedup: () => ({ findings: [{ title: 'Bug A', file: 'src/a.js', line: '1', class: 'logic', impact: 'x' }] }),
  skeptic: () => ({ verdicts: [{ findingRef: 'BUG-001', verdict: 'SURVIVED' }] }),
  referee: () => ({ judgments: [{ findingRef: 'BUG-001', verdict: 'CONFIRMED', severity: 'High' }] }),
  ...extra,
})

const runPoc = async (poc) => {
  let calls = 0
  const { runCycle } = await load({
    args: { ...baseArgs, pocPhase: true },
    agentImpl: dispatcherAgent(confirmedOneHandlers({ poc: () => { calls += 1; return poc() } })),
  })
  const out = await runCycle(0)
  assert.equal(out.survivors.length, 1, 'confirmed findings stand whatever the PoC agent does')
  assert.match(out.block, /^VERDICT: ISSUES_FOUND/)
  return { block: out.block, calls }
}

test('runCycle: PoC sketches are appended when the agent writes them', async () => {
  const { block } = await runPoc(() => ({ sketches: 'curl …' }))
  assert.match(block, /## Exploit Sketches\ncurl …/)
  assert.doesNotMatch(block, /PoC (declined|failed)/)
})

test('runCycle: a null PoC result is reported as a failure, not a decline', async () => {
  const { block } = await runPoc(() => null)
  assert.match(block, /PoC failed: /)
  assert.doesNotMatch(block, /PoC declined/)
})

test('runCycle: a PoC refusal is recorded as declined and not retried', async () => {
  const { block, calls } = await runPoc(() => { throw new Error('stop_reason: refusal') })
  assert.equal(calls, 1, 'a refusal is not re-asked')
  assert.match(block, /PoC declined: the PoC agent refused/)
  assert.doesNotMatch(block, /PoC failed/)
})

test('runCycle: a PoC agent that crashes on both attempts is reported as a failure', async () => {
  const { block, calls } = await runPoc(() => { throw new Error('socket hang up') })
  assert.equal(calls, 2, 'a crash gets one retry')
  assert.match(block, /PoC failed: /)
  assert.doesNotMatch(block, /PoC declined/)
})

test('runCycle: a PoC agent that sets `declined` is reported as declined, with its reason', async () => {
  const { block } = await runPoc(() => ({ sketches: '', declined: 'policy' }))
  assert.match(block, /PoC declined: policy\./)
  assert.doesNotMatch(block, /PoC failed/)
})

test('runCycle: every agent gets an effort, defaults per role, overridable via args.effort', async () => {
  const { runCycle, calls } = await load({
    args: { ...baseArgs, pocPhase: true, effort: { hunter: 'high' } },
    agentImpl: dispatcherAgent(confirmedOneHandlers({ poc: () => ({ sketches: 's' }) })),
  })
  await runCycle(0)
  const byRole = Object.fromEntries(calls.agent.map(({ opts }) => [opts.label.split(':')[0], opts.effort]))
  assert.deepEqual(byRole, { recon: 'low', hunt: 'high', dedup: 'low', skeptic: 'high', referee: 'high', poc: 'medium' })
})

test('runCycle: two-pass triage and single-pass fix agents get their role efforts', async () => {
  const { runCycle, calls } = await load({
    args: { ...baseArgs, applyFixes: true, finderScaling: [{ maxFiles: 1000, finders: 1, mode: 'two-pass' }] },
    agentImpl: dispatcherAgent(confirmedOneHandlers({
      triage: () => ({ summary: 't', files: baseArgs.scope.files, highRisk: baseArgs.scope.files }),
      'apply-fixes': () => ({ applied: ['BUG-001'], skipped: [] }),
    })),
  })
  await runCycle(0)
  const byRole = Object.fromEntries(calls.agent.map(({ opts }) => [opts.label.split(':')[0], opts.effort]))
  assert.equal(byRole.triage, 'low')
  assert.equal(byRole['apply-fixes'], 'medium')
})

test('runCycle: args.model sets a per-role model; omitted roles carry no model', async () => {
  const { runCycle, calls } = await load({
    args: { ...baseArgs, model: { hunter: 'sonnet' } },
    agentImpl: dispatcherAgent(confirmedOneHandlers({})),
  })
  await runCycle(0)
  const byRole = Object.fromEntries(calls.agent.map(({ opts }) => [opts.label.split(':')[0], opts.model]))
  assert.equal(byRole.hunt, 'sonnet')
  assert.equal(byRole.skeptic, undefined)
  assert.equal(byRole.referee, undefined)
})

test('runCycle: read-only roles get the report-length bound; fix agents get the hygiene rules', async () => {
  const { runCycle, calls } = await load({
    args: { ...baseArgs, applyFixes: true, backupDir: '/tmp/audit-x/backup', checkCommands: ['make test'] },
    agentImpl: dispatcherAgent(confirmedOneHandlers({
      'apply-fixes': () => ({ applied: ['BUG-001'], skipped: [] }),
    })),
  })
  await runCycle(0)
  const prompt = (role) => calls.agent.find(({ opts }) => opts.label.split(':')[0] === role).prompt
  for (const role of ['hunt', 'skeptic', 'referee']) assert.match(prompt(role), /REPORT LENGTH:/)
  assert.match(prompt('apply-fixes'), /LEAVE ONLY THE INTENDED EDITS/)
  assert.match(prompt('apply-fixes'), /no commit, stash, branch/)
  assert.match(prompt('apply-fixes'), /\/tmp\/audit-x\/backup/)
  assert.match(prompt('apply-fixes'), /checks from the project root: make test/)
})
