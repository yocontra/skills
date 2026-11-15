#!/usr/bin/env node
// sync-workflow-prompts.mjs — copy workflow prompt files into the scripts that use them.
//
// A workflow script has no filesystem, so it cannot read its own prompts/*.md.
// Telling each agent to read the file instead cost one extra tool round trip
// per agent, and the review workflow's prompt was read 220 times across
// sessions. Inlining the text also gives the agents of one phase a
// byte-identical prompt prefix they can share through the prompt cache.
//
// The .md stays the source of truth (the prose fallbacks link to it). Each
// workflow embeds a copy between markers:
//
//   // prompt-sync:begin prompts/dimension-review.md
//   const DIMENSION_PROTOCOL = `...`
//   // prompt-sync:end
//
// Usage:
//   node scripts/sync-workflow-prompts.mjs          # rewrite every block
//   node scripts/sync-workflow-prompts.mjs --check  # fail if any block is stale

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGINS = join(ROOT, 'plugins')
const CHECK = process.argv.includes('--check')
const BLOCK = /\/\/ prompt-sync:begin (\S+)\n(const \w+ = )`(?:[^`\\]|\\[\s\S])*`\n\/\/ prompt-sync:end/g

const literal = (text) => '`' + text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`'

const scripts = []
for (const plugin of readdirSync(PLUGINS)) {
  const workflows = join(PLUGINS, plugin, 'workflows')
  if (!existsSync(workflows)) continue
  for (const name of readdirSync(workflows)) {
    const dir = join(workflows, name)
    if (!statSync(dir).isDirectory()) continue
    for (const f of readdirSync(dir)) if (f.endsWith('.js')) scripts.push(join(dir, f))
  }
}

const stale = []
for (const script of scripts) {
  const src = readFileSync(script, 'utf8')
  const out = src.replace(BLOCK, (_, mdPath, decl) => {
    const text = readFileSync(join(dirname(script), mdPath), 'utf8')
    return `// prompt-sync:begin ${mdPath}\n${decl}${literal(text)}\n// prompt-sync:end`
  })
  if (out === src) continue
  stale.push(relative(ROOT, script))
  if (!CHECK) writeFileSync(script, out)
}

if (CHECK && stale.length) {
  console.error(`Workflow prompt copies are stale — run: node scripts/sync-workflow-prompts.mjs\n  ${stale.join('\n  ')}`)
  process.exit(1)
}
if (!CHECK && stale.length) console.log(`synced: ${stale.join(', ')}`)
