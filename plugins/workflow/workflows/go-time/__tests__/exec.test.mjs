// Behavior tests for the go-time exec workflow's file partitioning.
//
// The runtime loads exec.js as an AsyncFunction body with ambient globals
// (agent, parallel, phase, log, args) and no module system, so this harness
// compiles it the same way and drives it with stubs that record agent calls.
//
// Run: node --test plugins/workflow/workflows/go-time/__tests__/exec.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const BODY = readFileSync(resolve(HERE, '..', 'exec.js'), 'utf8').replace(/^export\s+const\s+meta/m, 'const meta')
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

async function run(args, found) {
  const calls = []
  let round = 0
  const agent = async (prompt, opts) => {
    calls.push({ prompt, ...opts })
    if (opts.label.startsWith('impl:')) return { done: true }
    if (opts.label.startsWith('review:')) {
      // Issues on the first review round only, from the completeness reviewer.
      const issues = opts.label === 'review:completeness' && round++ === 0 ? found : []
      return { approved: issues.length === 0, issues }
    }
    if (opts.label.startsWith('fix:')) return { fixed: [] }
    throw new Error(`unexpected agent ${opts.label}`)
  }
  const parallel = async (thunks) => Promise.all(thunks.map((t) => t()))
  const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'log', 'phase', 'args', 'budget', 'workflow', BODY)
  const out = await fn(agent, parallel, null, () => {}, () => {}, { ...args }, null, null)
  return { out, calls }
}

test('relative, dotted and absolute paths to one file get one fix agent', async () => {
  const issues = [
    { file: 'src/a.py', detail: 'one' },
    { file: './src/a.py', detail: 'two' },
    { file: '/repo/src/a.py', detail: 'three' },
    { file: '/repo/lib/../src//a.py', detail: 'four' },
    { file: 'src/b.py', detail: 'five' },
  ]
  const { calls } = await run({ tasks: [], audit: true, fixCap: 1, repoRoot: '/repo' }, issues)
  const fixes = calls.filter((c) => c.label.startsWith('fix:')).map((c) => c.label).sort()
  assert.deepEqual(fixes, ['fix:/repo/src/a.py', 'fix:/repo/src/b.py'])
  const a = calls.find((c) => c.label === 'fix:/repo/src/a.py')
  for (const d of ['one', 'two', 'three', 'four']) assert.match(a.prompt, new RegExp(`"detail": "${d}"`))
})

test('two tasks naming one file in different spellings run in separate waves', async () => {
  const tasks = [
    { id: 't1', text: 'x', files: ['src/a.py'] },
    { id: 't2', text: 'y', files: ['/repo/./src/a.py'] },
  ]
  const waves = []
  const agent = async () => ({ done: true })
  const parallel = async (thunks) => { waves.push(thunks.length); return Promise.all(thunks.map((t) => t())) }
  const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'log', 'phase', 'args', 'budget', 'workflow', BODY)
  const out = await fn(agent, parallel, null, () => {}, () => {}, { tasks, repoRoot: '/repo' }, null, null)
  assert.match(out, /IMPLEMENTED/)
  assert.deepEqual(waves, [1, 1])
})

test('implementers and fixers get the inlined protocol and the test command', async () => {
  const issues = [{ file: 'src/a.py', detail: 'one' }]
  const { calls } = await run({ tasks: [{ id: 't1', text: 'x', files: ['src/a.py'] }], audit: true, fixCap: 1, repoRoot: '/repo', testCmd: 'pnpm test' }, issues)
  const impl = calls.find((c) => c.label === 'impl:t1')
  const fix = calls.find((c) => c.label.startsWith('fix:'))
  const review = calls.find((c) => c.label === 'review:security-scan')
  assert.match(impl.prompt, /^# Implementer Protocol/)
  assert.match(impl.prompt, /TEST COMMAND: pnpm test/)
  assert.match(fix.prompt, /^# Fix Protocol/)
  assert.match(fix.prompt, /TEST COMMAND: pnpm test/)
  assert.doesNotMatch(review.prompt, /Read .*\.md/)
})
