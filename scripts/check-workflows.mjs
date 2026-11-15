#!/usr/bin/env node
// check-workflows.mjs — CI guard for bundled dynamic-workflow scripts.
//
// Validates that every workflow .js shipped by a plugin:
//   1. begins with a pure-literal `export const meta = {...}` block,
//   2. uses none of the runtime-forbidden constructs (import/require/fs,
//      Date.now/Math.random/argless new Date),
//   3. is syntactically valid JavaScript,
//   4. (symlinks) resolves to a real file inside the marketplace,
// and that every plugin's plugin.json version matches its marketplace.json entry.
//
// Usage: node scripts/check-workflows.mjs
// Exits non-zero on any violation.

import { readFileSync, readdirSync, statSync, lstatSync, existsSync, realpathSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGINS = join(ROOT, 'plugins')
const errors = []
const warnings = []
const err = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

// Forbidden runtime constructs (the workflow runtime has no FS/Node API; these throw).
const FORBIDDEN = [
  { re: /\bimport\s+[^.]/m, msg: 'static import (no module system at runtime)' },
  { re: /\bimport\s*\(/, msg: 'dynamic import() (no module system at runtime)' },
  { re: /\brequire\s*\(/, msg: 'require() (no module system at runtime)' },
  { re: /\bDate\.now\s*\(/, msg: 'Date.now() (throws at runtime)' },
  { re: /\bMath\.random\s*\(/, msg: 'Math.random() (throws at runtime)' },
  { re: /\bnew\s+Date\s*\(\s*\)/, msg: 'argless new Date() (throws at runtime)' },
  { re: /\bprocess\./, msg: 'process.* (no Node API at runtime)' },
  { re: /\b(readFileSync|writeFileSync|readdirSync)\b/, msg: 'fs API (no filesystem at runtime)' },
]

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

function lintWorkflow(path, displayName) {
  let src
  try {
    src = readFileSync(path, 'utf8')
  } catch (e) {
    err(`${displayName}: cannot read (${e.message})`)
    return
  }
  if (!/^export\s+const\s+meta\s*=\s*\{/m.test(src)) {
    err(`${displayName}: missing \`export const meta = {...}\``)
  }
  // Strip comments before scanning for forbidden constructs (a comment that
  // merely *names* Date.now/Math.random must not trip the guard), and the
  // prompt copies sync-workflow-prompts.mjs embeds: they are prose for agents,
  // where "import os" is an example, not a statement.
  const code = src
    .replace(/\/\/ prompt-sync:begin[\s\S]*?\/\/ prompt-sync:end/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  for (const f of FORBIDDEN) {
    if (f.re.test(code)) err(`${displayName}: forbidden — ${f.msg}`)
  }
  // Syntax check: strip the export keyword, compile as an async function body
  // with the ambient workflow globals declared. Never executed.
  const body = src.replace(/^export\s+const\s+meta/m, 'const meta')
  try {
    // eslint-disable-next-line no-new
    new AsyncFunction('agent', 'parallel', 'pipeline', 'log', 'phase', 'args', 'budget', 'workflow', body)
  } catch (e) {
    err(`${displayName}: syntax error — ${e.message}`)
  }
}

// 1. Discover and lint every plugins/*/skills/*/*.js and plugins/*/workflows/*/*.js
//    (and the symlink targets).
const seenTargets = new Set()
function scanPluginSubtree(plugin, subdirName) {
  const root = join(PLUGINS, plugin, subdirName)
  if (!existsSync(root)) return
  for (const entry of readdirSync(root)) {
    const sdir = join(root, entry)
    if (!statSync(sdir).isDirectory()) continue
    for (const f of readdirSync(sdir)) {
      if (!f.endsWith('.js')) continue
      const p = join(sdir, f)
      const disp = `plugins/${plugin}/${subdirName}/${entry}/${f}`
      const ls = lstatSync(p)
      if (ls.isSymbolicLink()) {
        let real
        try {
          real = realpathSync(p)
        } catch {
          err(`${disp}: dangling symlink`)
          continue
        }
        const rel = relative(ROOT, real)
        if (rel.startsWith('..')) err(`${disp}: symlink escapes the marketplace -> ${rel}`)
        // lint the real target once
        if (!seenTargets.has(real)) {
          seenTargets.add(real)
          lintWorkflow(real, rel)
        }
      } else {
        lintWorkflow(p, disp)
      }
    }
  }
}
for (const plugin of readdirSync(PLUGINS)) {
  scanPluginSubtree(plugin, 'skills')
  scanPluginSubtree(plugin, 'workflows')
}

// 2. Lint the shared engine source explicitly (in case nothing links it yet).
const engine = join(ROOT, 'shared/workflows/adversarial-audit.js')
if (existsSync(engine) && !seenTargets.has(realpathSync(engine))) {
  lintWorkflow(engine, 'shared/workflows/adversarial-audit.js')
}

// 2b. Run the shared-engine behavior harness so the engine's verdict block,
// CVE grounding, forever-mode loop, two-pass triage, and survivor selection
// are exercised end-to-end against canned hunter/skeptic/referee responses.
// This catches regressions that pure source-level lint cannot — every plugin
// reaches the engine via symlink, so any silent break would ripple to all of
// them. Skipped if the harness file is missing (e.g. minimal checkout).
const enginetest = join(ROOT, 'shared/workflows/__tests__/adversarial-audit.test.mjs')
if (existsSync(enginetest)) {
  const { spawnSync } = await import('node:child_process')
  const res = spawnSync(process.execPath, ['--test', enginetest], { stdio: 'inherit' })
  if (res.status !== 0) {
    err(`shared/workflows/adversarial-audit.test.mjs: harness failed (exit ${res.status})`)
  }
}

// 3. Version parity: plugin.json <-> marketplace.json entry.
const market = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/marketplace.json'), 'utf8'))
const marketByName = new Map(market.plugins.map((p) => [p.name, p.version]))
const marketNames = new Set(market.plugins.map((p) => p.name))
for (const plugin of readdirSync(PLUGINS)) {
  const pjPath = join(PLUGINS, plugin, '.claude-plugin/plugin.json')
  if (!existsSync(pjPath)) continue
  const pj = JSON.parse(readFileSync(pjPath, 'utf8'))
  if (!marketByName.has(pj.name)) {
    err(`plugin "${pj.name}" not listed in marketplace.json`)
    continue
  }
  if (marketByName.get(pj.name) !== pj.version) {
    err(`version drift: ${pj.name} plugin.json=${pj.version} marketplace.json=${marketByName.get(pj.name)}`)
  }
}
// reverse: marketplace entries whose plugin dir is gone
for (const p of market.plugins) {
  const dir = join(ROOT, p.source.replace(/^\.\//, ''))
  if (!existsSync(dir)) err(`marketplace entry "${p.name}" -> missing dir ${p.source}`)
}

// ---- report ----
for (const w of warnings) console.warn(`warn: ${w}`)
if (errors.length) {
  console.error(`\ncheck-workflows: ${errors.length} error(s):`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
console.log('check-workflows: OK')
