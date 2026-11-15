// Behavior tests for the openspec SessionStart hook that installs the
// spec-driven-tested schema (hooks/install-schema.sh). Each case runs the real
// script with a throwaway HOME (and XDG_DATA_HOME where set) and checks the
// installed files, what the hook prints, and that it exits 0.
//
// Run: node --test plugins/openspec/hooks/__tests__/install-schema.test.mjs

import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'

const PLUGIN = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const HOOK = join(PLUGIN, 'hooks/install-schema.sh')
const SRC = join(PLUGIN, 'schemas/spec-driven-tested')

const created = []
afterEach(() => {
  for (const dir of created.splice(0)) {
    spawnSync('chmod', ['-R', 'u+w', dir])
    rmSync(dir, { recursive: true, force: true })
  }
})

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'openspec-schema-'))
  created.push(dir)
  return dir
}

function runHook(env) {
  return spawnSync('/bin/sh', [HOOK], {
    env: { PATH: '/usr/bin:/bin', CLAUDE_PLUGIN_ROOT: PLUGIN, ...env },
    encoding: 'utf8',
  })
}

function assertInstalled(schemas) {
  const dest = join(schemas, 'spec-driven-tested')
  const diff = spawnSync('diff', ['-rq', SRC, dest], { encoding: 'utf8' })
  assert.equal(diff.status, 0, diff.stdout)
  // Nothing left behind from the temp-dir-and-rename copy.
  assert.deepEqual(readdirSync(schemas), ['spec-driven-tested'])
}

test('missing dir installs the schema silently', () => {
  const home = scratch()
  const r = runHook({ HOME: home })
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '')
  assertInstalled(join(home, '.local/share/openspec/schemas'))
})

test('stale content is replaced, including files upstream dropped', () => {
  const home = scratch()
  const dest = join(home, '.local/share/openspec/schemas/spec-driven-tested')
  mkdirSync(join(dest, 'templates'), { recursive: true })
  writeFileSync(join(dest, 'schema.yaml'), 'name: spec-driven-tested\nversion: 0\n')
  writeFileSync(join(dest, 'templates/gone.md'), 'old\n')
  const r = runHook({ HOME: home })
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '')
  assertInstalled(join(home, '.local/share/openspec/schemas'))
})

test('up-to-date copy prints nothing and is left in place', () => {
  const home = scratch()
  assert.equal(runHook({ HOME: home }).status, 0)
  const schemas = join(home, '.local/share/openspec/schemas')
  // A read-only schemas dir proves the second run writes nothing.
  chmodSync(schemas, 0o555)
  const r = runHook({ HOME: home })
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '')
  assertInstalled(schemas)
})

test('XDG_DATA_HOME wins over HOME', () => {
  const home = scratch()
  const data = scratch()
  const r = runHook({ HOME: home, XDG_DATA_HOME: data })
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '')
  assertInstalled(join(data, 'openspec/schemas'))
  assert.equal(existsSync(join(home, '.local')), false)
})

test('unwritable dir warns once and exits 0', () => {
  const home = scratch()
  const schemas = join(home, '.local/share/openspec/schemas')
  mkdirSync(join(schemas, 'spec-driven-tested'), { recursive: true })
  writeFileSync(join(schemas, 'spec-driven-tested/schema.yaml'), 'stale\n')
  chmodSync(schemas, 0o555)
  const r = runHook({ HOME: home })
  assert.equal(r.status, 0)
  const out = JSON.parse(r.stdout)
  assert.match(out.systemMessage, /cannot write the spec-driven-tested schema/)
  assert.ok(out.systemMessage.includes(schemas))
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart')
  assert.equal(out.hookSpecificOutput.additionalContext, out.systemMessage)
  // The stale copy is kept rather than half-replaced.
  assert.equal(readFileSync(join(schemas, 'spec-driven-tested/schema.yaml'), 'utf8'), 'stale\n')
  assert.deepEqual(readdirSync(schemas), ['spec-driven-tested'])
})
