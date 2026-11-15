#!/usr/bin/env node
// stamp-version.mjs — set a plugin's version in both its plugin.json and the
// marketplace.json entry. Used by `make sync` to pin synced skills to their
// upstream CLI version so the two never drift.
//
// Usage: node scripts/stamp-version.mjs <plugin> <version>

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [plugin, version] = process.argv.slice(2)
if (!plugin || !version) {
  console.error('usage: stamp-version.mjs <plugin> <version>')
  process.exit(2)
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// plugin.json
const pjPath = join(ROOT, 'plugins', plugin, '.claude-plugin', 'plugin.json')
if (!existsSync(pjPath)) {
  console.error(`stamp-version: ${pjPath} not found`)
  process.exit(1)
}
const pj = JSON.parse(readFileSync(pjPath, 'utf8'))
if (pj.version !== version) {
  pj.version = version
  writeFileSync(pjPath, JSON.stringify(pj, null, 2) + '\n')
}

// marketplace.json entry (keep parity)
const mpPath = join(ROOT, '.claude-plugin', 'marketplace.json')
const mp = JSON.parse(readFileSync(mpPath, 'utf8'))
const entry = mp.plugins.find((e) => e.name === plugin)
if (entry) {
  if (entry.version !== version) {
    entry.version = version
    writeFileSync(mpPath, JSON.stringify(mp, null, 2) + '\n')
  }
} else {
  console.error(`stamp-version: "${plugin}" not in marketplace.json`)
  process.exit(1)
}

console.log(`  ${plugin} version -> ${version}`)
