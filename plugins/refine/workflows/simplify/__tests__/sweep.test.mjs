// Behavior tests for the simplify-sweep workflow's batching and revert path.
//
// The runtime loads sweep.js as an AsyncFunction body with ambient globals and
// no module system, so this harness compiles it the same way and drives it
// with stubs that record every agent call.
//
// Run: node --test plugins/refine/workflows/simplify/__tests__/sweep.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const BODY = readFileSync(resolve(HERE, '..', 'sweep.js'), 'utf8').replace(/^export\s+const\s+meta/m, 'const meta')
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

const filesIn = (prompt) => [...prompt.slice(prompt.lastIndexOf('FILES')).matchAll(/^- (\/[^\s:]+)/gm)].map((m) => m[1])

async function run(args, { simplify, review, gate } = {}) {
  const calls = []
  const agent = async (prompt, opts) => {
    calls.push({ prompt, ...opts })
    const files = filesIn(prompt)
    if (opts.label === 'gate') return gate(prompt)
    if (opts.label.startsWith('simplify:')) {
      if (simplify) return simplify(files)
      return { results: files.map((file) => ({ file, changed: true, summary: 's' })) }
    }
    if (opts.label.startsWith('review:')) {
      if (review) return review(files)
      return { results: files.map((file) => ({ file, preserved: true, reverted: false })) }
    }
    throw new Error(`unexpected agent ${opts.label}`)
  }
  const parallel = async (thunks) => Promise.all(thunks.map((t) => t().catch(() => null)))
  const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'log', 'phase', 'args', 'budget', 'workflow', BODY)
  const out = await fn(agent, parallel, null, () => {}, () => {}, args, null, null)
  return {
    out,
    simplifiers: calls.filter((c) => c.label.startsWith('simplify:')),
    reviewers: calls.filter((c) => c.label.startsWith('review:')),
    gates: calls.filter((c) => c.label === 'gate'),
  }
}

const BASE = { files: ['a.py', 'b.py', 'c.py'], worktree: '/wt', snapshotDir: '/snap/' }

test('a small diff gets one simplifier and one reviewer for every file', async () => {
  const { simplifiers, reviewers, out } = await run({ ...BASE, changedLines: 60 })
  assert.equal(simplifiers.length, 1)
  assert.deepEqual(filesIn(simplifiers[0].prompt), ['/wt/a.py', '/wt/b.py', '/wt/c.py'])
  assert.equal(reviewers.length, 1)
  assert.match(out, /^SIMPLIFY: 3 file\(s\) simplified/)
})

test('a larger diff, an unknown size, or forever mode runs per file', async () => {
  assert.equal((await run({ ...BASE, changedLines: 150 })).simplifiers.length, 3)
  assert.equal((await run(BASE)).simplifiers.length, 3)
  const forever = await run({ ...BASE, changedLines: 10, forever: { enabled: true, cap: 1 } })
  assert.equal(forever.simplifiers.length, 3)
})

test('protocols are inline', async () => {
  const { simplifiers, reviewers } = await run({ ...BASE, changedLines: 60 })
  for (const c of [...simplifiers, ...reviewers]) {
    assert.doesNotMatch(c.prompt, /prompts\/|\.md for the/)
  }
  assert.match(simplifiers[0].prompt, /^# Simplify files/)
})

test('simplifiers copy each file to a per-pass snapshot before editing', async () => {
  const { simplifiers } = await run({ ...BASE, changedLines: 60 })
  assert.match(simplifiers[0].prompt, /mkdir -p \/snap\/pass-1/)
  assert.match(simplifiers[0].prompt, /- \/wt\/b\.py -> \/snap\/pass-1\/__wt__b\.py/)
})

test('the reviewer restores from the snapshot copy, never from git', async () => {
  const { reviewers } = await run({ ...BASE, changedLines: 60 })
  assert.match(reviewers[0].prompt, /cp <snapshot> <file>/)
  assert.match(reviewers[0].prompt, /\/wt\/a\.py \(snapshot \/snap\/pass-1\/__wt__a\.py\)/)
  assert.doesNotMatch(reviewers[0].prompt, /checkout -- /)
})

test('without a snapshot directory the reviewer is told not to revert', async () => {
  const { simplifiers, reviewers, out } = await run({ ...BASE, snapshotDir: undefined, changedLines: 60 }, {
    review: (files) => ({ results: files.map((file) => ({ file, preserved: false, reverted: false, reason: 'unsure' })) }),
  })
  assert.match(simplifiers[0].prompt, /No snapshot directory was given/)
  assert.match(reviewers[0].prompt, /No snapshots exist for this run, so do not revert/)
  assert.match(out, /3 unverified/)
})

test('a failed simplifier still sends every file to review', async () => {
  const { reviewers } = await run({ ...BASE, changedLines: 60 }, { simplify: () => { throw new Error('schema') } })
  assert.deepEqual(filesIn(reviewers[0].prompt), ['/wt/a.py', '/wt/b.py', '/wt/c.py'])
})

test('a verdict attaches to its own file even when the reply reorders or drops files', async () => {
  const { out } = await run({ ...BASE, changedLines: 60 }, {
    review: () => ({ results: [{ file: '/wt/c.py', preserved: false, reverted: true, reason: 'changed' }, { file: '/wt/a.py', preserved: true, reverted: false }] }),
  })
  assert.match(out, /1 file\(s\) simplified, 1 reverted .*1 unverified/)
  assert.match(out, /Reverted: \/wt\/c\.py/)
  assert.match(out, /\/wt\/b\.py: s \[review failed/)
})

const GATED = { ...BASE, changedLines: 60, runGate: { enabled: true, command: 'bash tools/x-selftest.sh' } }

test('the gate is told to run from the worktree', async () => {
  const { gates, out } = await run(GATED, { gate: () => ({ ran: true, cwd: '/wt/', passed: true }) })
  assert.equal(gates.length, 1)
  assert.match(gates[0].prompt, /cd "\/wt" && pwd && bash tools\/x-selftest\.sh/)
  assert.match(out, /Gate \(bash tools\/x-selftest\.sh\): PASS/)
})

test('a reported cwd with the newline pwd prints still matches the worktree', async () => {
  const { out } = await run(GATED, { gate: () => ({ ran: true, cwd: '/wt\n', passed: true }) })
  assert.match(out, /Gate \(bash tools\/x-selftest\.sh\): PASS/)
})

test('a gate that ran in another tree fails, even when it reports a pass', async () => {
  const { out } = await run(GATED, { gate: () => ({ ran: true, cwd: '/main', passed: true }) })
  assert.match(out, /Gate .*: FAIL — gate ran in \/main, not the worktree \/wt/)
})

test('a gate that could not run fails with its reason', async () => {
  const { out } = await run(GATED, { gate: () => ({ ran: false, cwd: '/wt', passed: true, detail: 'tools/x-selftest.sh does not exist' }) })
  assert.match(out, /Gate .*: FAIL — gate could not run: tools\/x-selftest\.sh does not exist/)
})

test('a gate agent that errors twice fails', async () => {
  const { out } = await run(GATED, { gate: () => { throw new Error('boom') } })
  assert.match(out, /Gate .*: FAIL — gate run unavailable/)
})
