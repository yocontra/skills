// Behavior tests for the bug-bash triage workflow: coverage, dedup and fix waves.
//
// The runtime loads triage.js as an AsyncFunction body with ambient globals
// (agent, pipeline, phase, log, args), so this harness compiles it the same way
// and drives it with stub agents keyed by label.
//
// Run: node --test plugins/workflow/workflows/bug-bash/__tests__/triage.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const BODY = readFileSync(resolve(HERE, '..', 'triage.js'), 'utf8').replace(/^export\s+const\s+meta/m, 'const meta')
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

// Same contract as the runtime: items run through stages independently; a throwing stage drops the item to null.
const pipeline = (items, ...stages) => Promise.all(items.map(async (item, i) => {
  try {
    let v = item
    for (const [n, stage] of stages.entries()) v = await stage(n === 0 ? item : v, item, i)
    return v
  } catch {
    return null
  }
}))

const issue = (number) => ({ number: Number(number), title: `bug ${number}`, author: 'octocat', labels: ['bug'], url: `https://github.com/o/r/issues/${number}` })

// plans: { number: { bucket, files } }, groups: dedup output, dead: numbers whose investigate agent returns null.
async function run({ plans, groups = [], dead = [] }) {
  const calls = []
  const agent = async (prompt, opts) => {
    calls.push({ label: opts.label, prompt })
    const [stage, n] = opts.label.split(':')
    if (stage === 'investigate') return dead.includes(n) ? null : { kind: 'code-bug', claim: 'x', alreadyDone: false, evidence: [], suspectedFiles: [], reproPlan: 'x', possibleDuplicateOf: [] }
    if (stage === 'repro') return { status: 'reproduced', method: 'unit-test', commands: [], observed: 'a', expected: 'b' }
    if (stage === 'skeptic') return { upheld: true, reason: 'ok', status: 'reproduced' }
    if (stage === 'plan') {
      const p = plans[n]
      return { bucket: p.bucket, rootCause: 'rc', files: p.files || [], size: 'S', action: { change: 'none', commentFile: '' } }
    }
    if (stage === 'dedup') return { groups }
    throw new Error(`unexpected agent ${opts.label}`)
  }
  const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'log', 'phase', 'args', 'budget', 'workflow', BODY)
  const args = { issues: Object.keys(plans).map(issue), repo: 'o/r', repoRoot: '/repo', defaultBranch: 'main', runDir: '/run' }
  const out = await fn(agent, null, pipeline, () => {}, () => {}, args, null, null)
  return { out, calls }
}

const unitIds = (waves) => waves.map((w) => w.map((u) => u.unit).sort())

test('an issue whose agent dies lands in failed, never silently dropped', async () => {
  const { out, calls } = await run({ plans: { 1: { bucket: 'fix', files: ['a.py'] }, 2: { bucket: 'user-guidance' } }, dead: ['2'] })
  assert.deepEqual(out.failed, ['2'])
  assert.deepEqual(out.results.map((r) => r.number), ['1'])
  assert.ok(!calls.some((c) => c.label === 'repro:2'), 'a dead investigation stops that issue')
})

test('only fix and docs-fix issues become go-time units', async () => {
  const { out } = await run({ plans: {
    1: { bucket: 'fix', files: ['a.py'] },
    2: { bucket: 'docs-fix', files: ['docs/x.md'] },
    3: { bucket: 'user-guidance' },
    4: { bucket: 'cannot-reproduce' },
    5: { bucket: 'already-fixed' },
  } })
  assert.deepEqual(unitIds(out.waves), [['1', '2']])
  assert.equal(out.counts['user-guidance'], 1)
})

test('a duplicate of a fix is closed as a duplicate and gets no unit, even with # in the numbers', async () => {
  const { out } = await run({
    plans: { 10: { bucket: 'fix', files: ['a.py'] }, 20: { bucket: 'fix', files: ['b.py'] } },
    groups: [{ original: '#10', members: ['#10', '#20'], relation: 'duplicate', reason: 'same' }],
  })
  const dup = out.results.find((r) => r.number === '20')
  assert.equal(dup.bucket, 'duplicate')
  assert.equal(dup.action.change, 'close')
  assert.equal(dup.action.closeReason, 'duplicate')
  assert.equal(dup.action.duplicateOf, '10')
  assert.deepEqual(unitIds(out.waves), [['10']])
})

test('issues with one root cause share one unit', async () => {
  const { out } = await run({
    plans: { 30: { bucket: 'fix', files: ['a.py'] }, 31: { bucket: 'fix', files: ['b.py'] } },
    groups: [{ original: '30', members: ['31'], relation: 'same-root-cause', reason: 'one bug' }],
  })
  assert.equal(out.waves.length, 1)
  assert.deepEqual(out.waves[0], [{ unit: '30', issues: ['30', '31'] }])
})

test('units that share a file, in any spelling, run in separate waves; others run together', async () => {
  const { out } = await run({ plans: {
    40: { bucket: 'fix', files: ['src/a.py'] },
    41: { bucket: 'fix', files: ['./src/a.py'] },
    42: { bucket: 'fix', files: ['src/b.py'] },
  } })
  assert.deepEqual(unitIds(out.waves), [['40', '42'], ['41']])
})

test('every agent prompt fences issue text as data and forbids GitHub writes', async () => {
  const { calls } = await run({ plans: { 50: { bucket: 'fix', files: ['a.py'] }, 51: { bucket: 'fix', files: ['b.py'] } } })
  for (const c of calls) {
    assert.match(c.prompt, /Never write to GitHub/, c.label)
    assert.match(c.prompt, /<dataSource:issues>[\s\S]*<\/dataSource:issues>/, c.label)
  }
})
