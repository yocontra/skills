// Behavior tests for the openspec SessionStart hook (hooks/check-cli.sh).
// Each case runs the real script with a PATH that holds a stub `openspec`
// (or none) and checks what the hook prints and that it exits 0.
//
// Run: node --test plugins/openspec/hooks/__tests__/check-cli.test.mjs

import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'

const PLUGIN = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const HOOK = join(PLUGIN, 'hooks/check-cli.sh')
const PIN = readFileSync(join(PLUGIN, 'openspec-version'), 'utf8').trim()
const FIX = `npm install -g @fission-ai/openspec@${PIN}`

const created = []
afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function runHook(version) {
  const bin = mkdtempSync(join(tmpdir(), 'openspec-hook-'))
  created.push(bin)
  if (version !== null) {
    const stub = join(bin, 'openspec')
    writeFileSync(stub, `#!/bin/sh\necho "${version}"\n`)
    chmodSync(stub, 0o755)
  }
  // /usr/bin:/bin supplies tr, head, dirname; no openspec lives there.
  return spawnSync('/bin/sh', [HOOK], {
    env: { PATH: `${bin}:/usr/bin:/bin`, CLAUDE_PLUGIN_ROOT: PLUGIN },
    encoding: 'utf8',
  })
}

test('pinned version on PATH prints nothing', () => {
  const r = runHook(PIN)
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '')
})

test('missing CLI prints the install command', () => {
  const r = runHook(null)
  assert.equal(r.status, 0)
  const out = JSON.parse(r.stdout)
  assert.match(out.systemMessage, /not on PATH/)
  assert.ok(out.systemMessage.endsWith(FIX))
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart')
  assert.equal(out.hookSpecificOutput.additionalContext, out.systemMessage)
})

test('wrong version names both versions and the install command', () => {
  const r = runHook('0.9.0')
  assert.equal(r.status, 0)
  const out = JSON.parse(r.stdout)
  assert.match(out.systemMessage, new RegExp(`is 0\\.9\\.0, the plugin needs ${PIN.replace(/\./g, '\\.')}`))
  assert.ok(out.systemMessage.endsWith(FIX))
})

test('hostile version output cannot break the JSON', () => {
  const r = runHook('1.0"}\\\\n')
  assert.equal(r.status, 0)
  assert.doesNotThrow(() => JSON.parse(r.stdout))
})
