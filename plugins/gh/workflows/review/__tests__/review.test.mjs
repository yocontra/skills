// Behavior tests for the pr-review workflow's fan-out and prompts.
//
// The runtime loads review.js as an AsyncFunction body with ambient globals
// (agent, parallel, phase, log, args) and no module system, so this harness
// compiles it the same way and drives it with stubs that record every agent
// call and return canned results keyed off the label.
//
// Run: node --test plugins/gh/workflows/review/__tests__/review.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const BODY = readFileSync(resolve(HERE, '..', 'review.js'), 'utf8').replace(/^export\s+const\s+meta/m, 'const meta')
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
const PROTOCOL_HEAD = readFileSync(resolve(HERE, '..', 'prompts', 'dimension-review.md'), 'utf8').split('\n')[0]

const FINDING = { path: 'pkg/app.py', line: 3, tier: 'Bug', severity: 'High', title: 't', detail: 'd' }

async function run(args, { findings = () => 0, worthReviewing = true } = {}) {
  const calls = []
  const agent = async (prompt, opts) => {
    calls.push({ prompt, ...opts })
    if (opts.label === 'triage') return { worthReviewing, reason: 'r' }
    if (opts.label.startsWith('review:')) {
      const dims = opts.label.slice('review:'.length).split('+')
      return { findings: Array.from({ length: findings(opts.label) }, () => ({ ...FINDING, ...(dims.length > 1 ? { dimension: dims[0] } : {}) })) }
    }
    if (opts.label.startsWith('verify:')) {
      const ids = [...prompt.matchAll(/"id": "(F\d+)"/g)].map((m) => m[1])
      return { verdicts: ids.map((id) => ({ id, real: true, confidence: 90 })) }
    }
    if (opts.label === 'merge') return { findings: [] }
    throw new Error(`unexpected agent ${opts.label}`)
  }
  const parallel = async (thunks) => Promise.all(thunks.map((t) => t().catch(() => null)))
  const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'log', 'phase', 'args', 'budget', 'workflow', BODY)
  const out = JSON.parse(await fn(agent, parallel, null, () => {}, () => {}, args, null, null))
  return { out, calls, reviewers: calls.filter((c) => c.label.startsWith('review:')) }
}

const BASE = { diffPath: '/r/diff.txt', filesDir: '/r/files', repoPath: '/r/repo', conventionsPath: '/r/conv.md' }

test('a small diff gets two combined reviewers', async () => {
  const { reviewers } = await run({ ...BASE, changedLines: 40 })
  assert.deepEqual(reviewers.map((c) => c.label), ['review:logic+security+errors+performance', 'review:architecture+tests+conventions'])
})

test('a diff at the threshold, or of unknown size, gets all seven', async () => {
  for (const args of [{ ...BASE, changedLines: 150 }, { ...BASE, changedLines: undefined }, { diffPath: '/r/diff.txt' }]) {
    const { reviewers } = await run(args)
    assert.equal(reviewers.length, 7)
  }
})

test('fanOutAt moves the threshold, and a string count still counts', async () => {
  assert.equal((await run({ ...BASE, changedLines: '300', fanOutAt: 400 })).reviewers.length, 2)
})

test('reviewers get the protocol inline, first, and never a prompt path', async () => {
  const { reviewers } = await run({ ...BASE, changedLines: 40 })
  for (const c of reviewers) {
    assert.ok(c.prompt.startsWith(PROTOCOL_HEAD))
    assert.doesNotMatch(c.prompt, /prompts\/|dimension-review\.md/)
  }
  // Everything before the per-agent DIMENSION line is shared, so the agents
  // can reuse each other's prompt cache.
  const [a, b] = reviewers.map((c) => c.prompt.slice(0, c.prompt.indexOf('  DIMENSION:')))
  assert.equal(a, b)
})

test('a small diff is read whole; a large one per file', async () => {
  const small = await run({ ...BASE, changedLines: 400 })
  assert.match(small.reviewers[0].prompt, /Read DIFF once, in full/)
  const large = await run({ ...BASE, changedLines: 5000 })
  for (const c of large.reviewers) {
    assert.match(c.prompt, /do not read DIFF whole/)
    assert.match(c.prompt, /\/r\/files\/manifest\.txt/)
  }
})

test('combined reviewers label each finding with one of their own dimensions', async () => {
  const { reviewers } = await run({ ...BASE, changedLines: 40 })
  assert.deepEqual(reviewers[1].schema.properties.findings.items.properties.dimension.enum, ['architecture', 'tests', 'conventions'])
  const single = await run({ ...BASE, changedLines: 400 })
  assert.equal(single.reviewers[0].schema.properties.findings.items.properties.dimension, undefined)
})

test('a verifier reads only the diffs of the files its findings cite', async () => {
  const { calls } = await run({ ...BASE, changedLines: 40 }, { findings: () => 1 })
  const verify = calls.find((c) => c.label.startsWith('verify:'))
  assert.match(verify.prompt, /\/r\/files\/pkg__app\.py\.diff/)
})

test('a single surviving finding skips the merge agent', async () => {
  const one = await run({ ...BASE, changedLines: 400 }, { findings: (label) => (label === 'review:logic' ? 1 : 0) })
  assert.equal(one.out.findings.length, 1)
  assert.equal(one.calls.some((c) => c.label === 'merge'), false)
  const many = await run({ ...BASE, changedLines: 400 }, { findings: () => 1 })
  assert.equal(many.calls.some((c) => c.label === 'merge'), true)
})

test('triage skip short-circuits with a note', async () => {
  const { out, reviewers } = await run({ ...BASE, changedLines: 40 }, { worthReviewing: false })
  assert.equal(reviewers.length, 0)
  assert.match(out.note, /^triage:/)
})
