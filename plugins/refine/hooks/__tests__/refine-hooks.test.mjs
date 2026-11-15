// Behavior tests for the refine hooks (hooks/hooks.json, refine-watch.js,
// refine-mode.js). The PostToolUse gate runs through /bin/sh exactly as the
// harness runs it; the off-by-default cases use a PATH with no `node`, so any
// attempt to start it fails the test.
//
// Run: node --test plugins/refine/hooks/__tests__/refine-hooks.test.mjs

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'

const PLUGIN = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const HOOKS = JSON.parse(readFileSync(join(PLUGIN, 'hooks/hooks.json'), 'utf8')).hooks
const GATE = HOOKS.PostToolUse[0].hooks[0].command
const NODE_DIR = dirname(process.execPath)
const EDIT = JSON.stringify({ session_id: 's1', tool_input: { file_path: '/tmp/x.ts' } })

const created = []
afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function configDir(mode) {
  const dir = mkdtempSync(join(tmpdir(), 'refine-hook-'))
  created.push(dir)
  if (mode !== null) writeFileSync(join(dir, '.refine-mode'), mode)
  return dir
}

function runGate(dir, path) {
  return spawnSync('/bin/sh', ['-c', GATE], {
    input: EDIT,
    env: { PATH: path, HOME: dir, CLAUDE_CONFIG_DIR: dir, CLAUDE_PLUGIN_ROOT: PLUGIN },
    encoding: 'utf8',
  })
}

function runMode(dir, ...args) {
  return spawnSync(process.execPath, [join(PLUGIN, 'hooks/refine-mode.js'), ...args], {
    env: { CLAUDE_CONFIG_DIR: dir },
    encoding: 'utf8',
  })
}

test('no prompt hook is registered', () => {
  assert.deepEqual(Object.keys(HOOKS), ['PostToolUse'])
})

for (const mode of [null, 'off']) {
  test(`mode ${mode ?? 'missing'}: edit gate exits 0 without starting node`, () => {
    const r = runGate(configDir(mode), '/usr/bin:/bin')
    assert.equal(r.status, 0, r.stderr)
    assert.equal(r.stdout, '')
  })
}

test('mode auto: edit gate nudges once per file', () => {
  const dir = configDir('auto')
  const first = runGate(dir, `${NODE_DIR}:/usr/bin:/bin`)
  assert.equal(first.status, 0, first.stderr)
  assert.match(JSON.parse(first.stdout).hookSpecificOutput.additionalContext, /\/refine:simplify/)
  assert.equal(runGate(dir, `${NODE_DIR}:/usr/bin:/bin`).stdout, '')
})

test('refine-mode.js reports off by default and persists a new mode', () => {
  const dir = configDir(null)
  assert.match(runMode(dir).stdout, /REFINE MODE: off/)
  assert.match(runMode(dir, 'AUTO').stdout, /REFINE MODE: auto/)
  assert.equal(readFileSync(join(dir, '.refine-mode'), 'utf8'), 'auto')
  assert.match(runMode(dir, 'status').stdout, /REFINE MODE: auto/)
})

test('refine-mode.js rejects an unknown mode and leaves the flag alone', () => {
  const dir = configDir('off')
  const r = runMode(dir, 'bogus')
  assert.equal(r.status, 1)
  assert.match(r.stdout, /Unknown mode/)
  assert.equal(readFileSync(join(dir, '.refine-mode'), 'utf8'), 'off')
})

test('turning the mode off removes every per-session nudge record', () => {
  const dir = configDir('auto')
  runGate(dir, `${NODE_DIR}:/usr/bin:/bin`)
  assert.ok(existsSync(join(dir, '.refine-nudged-s1')), 'the auto-mode edit recorded a nudge')
  runMode(dir, 'off')
  assert.equal(existsSync(join(dir, '.refine-nudged-s1')), false)
  assert.equal(readFileSync(join(dir, '.refine-mode'), 'utf8'), 'off')
})
