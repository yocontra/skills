#!/usr/bin/env node
/**
 * audit-evals.mjs — detect eval suites being weakened rather than improved.
 *
 * A hillclimb campaign rewards making cases pass. "Do not loosen a grader" is the
 * rule, but it leaves loopholes that are all visible in the files. This finds them.
 * Run it before a campaign to capture a snapshot, and after to compare:
 *
 *   node scripts/audit-evals.mjs --snapshot scripts/evals-snapshot.json
 *   node scripts/audit-evals.mjs --against  scripts/evals-snapshot.json
 *
 * With neither flag it just reports the absolute checks and today's totals.
 *
 * It also tracks total description bytes across all skills. Moving a fact into a
 * `description` is the cheapest way to raise Δ — the no-plugin arm has no
 * descriptions, so it is pure signal — and it is billed to every engineer on every
 * session forever. check-cost.mjs caps each description at 350 chars but nothing
 * caps the total, so a fleet can inflate all of them, pass every gate, and make the
 * marketplace permanently more expensive while reporting a cost win.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLUGINS = path.join(ROOT, 'plugins')
const UPSTREAM = new Set([])

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1] }
const snapshotTo = flag('--snapshot')
const against = flag('--against')

const problems = []
const warn = (m) => problems.push(m)

const frontmatter = (file) => {
  const m = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return null
  const keys = {}
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || /^\s/.test(line)) continue
    const i = line.indexOf(':')
    if (i > 0) keys[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return { keys, body: m[2], raw: m[1] }
}

const unquote = (v = '') => v.replace(/^['"]|['"]$/g, '')
const dirs = (p) => existsSync(p)
  ? readdirSync(p).filter((e) => !e.startsWith('.') && statSync(path.join(p, e)).isDirectory())
  : []

// ------------------------------------------------------------------ collect ----

const stats = { plugins: {}, descriptionBytes: 0, cases: 0, graders: 0 }

for (const plugin of dirs(PLUGINS).sort()) {
  if (UPSTREAM.has(plugin)) continue
  const p = { cases: 0, graders: 0, byType: {}, descriptionBytes: 0, skills: {}, patterns: {} }

  // Skills: description budget, and which skills exist.
  for (const s of dirs(path.join(PLUGINS, plugin, 'skills'))) {
    const f = path.join(PLUGINS, plugin, 'skills', s, 'SKILL.md')
    if (!existsSync(f)) continue
    const fm = frontmatter(f)
    if (!fm) {
      warn(`plugins/${plugin}/skills/${s}/SKILL.md: no parseable YAML frontmatter`)
      continue
    }
    // An unquoted scalar containing ": " makes the whole frontmatter invalid, so
    // the skill ships with no name and no description and never routes. Nothing
    // else in the gate catches this — it cost us a live skill once already.
    for (const [k, v] of Object.entries(fm.keys)) {
      if (/^['"]/.test(v)) continue
      if (v.includes(': ')) {
        warn(`plugins/${plugin}/skills/${s}/SKILL.md: \`${k}:\` contains ": " unquoted — this breaks the entire frontmatter and the skill stops routing`)
      }
    }
    const name = unquote(fm.keys.name ?? s)
    const desc = unquote(fm.keys.description ?? '')
    p.skills[name] = { assertedFiring: 0, descriptionBytes: desc.length }
    p.descriptionBytes += desc.length
  }

  for (const c of dirs(path.join(PLUGINS, plugin, 'evals'))) {
    if (c === 'results') continue
    const caseDir = path.join(PLUGINS, plugin, 'evals', c)
    const promptFile = path.join(caseDir, 'prompt.md')
    if (!existsSync(promptFile) && !existsSync(path.join(caseDir, 'case.yaml'))) continue
    p.cases++

    const gradersDir = path.join(caseDir, 'graders')
    const graderFiles = existsSync(gradersDir)
      ? readdirSync(gradersDir).filter((f) => f.endsWith('.md'))
      : []
    p.graders += graderFiles.length

    let firesInThisCase = []
    for (const g of graderFiles) {
      const label = `plugins/${plugin}/evals/${c}/graders/${g}`
      const fm = frontmatter(path.join(gradersDir, g))
      if (!fm) continue
      const type = unquote(fm.keys.type ?? '')
      p.byType[type] = (p.byType[type] ?? 0) + 1

      // Absolute checks — these keys are accepted by check-evals.mjs and never
      // validated, so either one silently rewrites what a case measures.
      if ('weight' in fm.keys) {
        warn(`${label}: sets \`weight: ${fm.keys.weight}\` — unvalidated, and a low weight on the strict grader hands the case to the easy one`)
      }
      if ('arm' in fm.keys) {
        warn(`${label}: sets \`arm: ${fm.keys.arm}\` — scoping a grader to one arm manufactures Δ directly`)
      }

      if (fm.keys.pattern) p.patterns[`${c}/${g}`] = unquote(fm.keys.pattern).length

      if (type === 'tool_used' && unquote(fm.keys.tool) === 'Skill' && fm.keys.input_match) {
        const excluded = String(fm.keys.max ?? '').trim() === '0'
        for (const m of unquote(fm.keys.input_match).matchAll(/([a-z0-9][a-z0-9-]*)"?\s*$/gi)) {
          if (!excluded) firesInThisCase.push(m[1])
        }
        const tail = unquote(fm.keys.input_match).match(/\)\?([a-z0-9-]+)"/i)
        if (tail && !excluded) firesInThisCase.push(tail[1])
      }
    }

    // A routing prompt that names the skill the way an *author* would is not
    // testing routing. But a skill named after a common verb or the product's own
    // CLI ("push", "rebase", "review", "simplify") appears in natural user phrasing
    // by necessity — flagging that would push cases away from real language. Only
    // the forms a user would never type count: the namespaced `plugin:skill`, a
    // slash command, a hyphenated internal name like `open-pr`, or the word
    // "skill" itself.
    if (existsSync(promptFile)) {
      const fm = frontmatter(promptFile)
      const tags = unquote(fm?.keys?.tags ?? '')
      if (/routing/.test(tags) && fm) {
        // A pasted URL is real user input; its path segments and hostname are not
        // the author naming a skill. Strip them before looking.
        const body = fm.body.toLowerCase().replace(/https?:\/\/\S+/g, ' ')
        if (/\bskills?\b/.test(body)) {
          warn(`plugins/${plugin}/evals/${c}/prompt.md: routing prompt says "skill" — users describe a task, they do not name the mechanism`)
        }
        for (const skill of new Set(firesInThisCase)) {
          const s = skill.toLowerCase()
          if (body.includes(`${plugin}:${s}`) || body.includes(`/${s}`)) {
            warn(`plugins/${plugin}/evals/${c}/prompt.md: routing prompt names the skill directly ("${skill}") — that hands it the answer`)
          } else if (s.includes('-') && body.includes(s)) {
            warn(`plugins/${plugin}/evals/${c}/prompt.md: routing prompt contains the internal skill name "${skill}" — a user would not phrase it that way`)
          }
        }
      }
    }

    for (const s of firesInThisCase) {
      if (p.skills[s]) p.skills[s].assertedFiring++
    }
  }

  // Coverage must come from a case asserting the skill FIRES. check-evals.mjs
  // counts any Skill grader naming it, including a `max: 0` exclusion case.
  for (const [name, s] of Object.entries(p.skills)) {
    if (p.cases > 0 && s.assertedFiring === 0) {
      warn(`plugins/${plugin}: skill "${name}" has no case asserting it FIRES (an exclusion case does not count)`)
    }
  }

  stats.plugins[plugin] = p
  stats.descriptionBytes += p.descriptionBytes
  stats.cases += p.cases
  stats.graders += p.graders
}

// ----------------------------------------------------------------- compare ----

if (against) {
  if (!existsSync(against)) {
    console.error(`audit-evals: no snapshot at ${against}`)
    process.exit(1)
  }
  const old = JSON.parse(readFileSync(against, 'utf8'))

  if (stats.descriptionBytes > old.descriptionBytes) {
    warn(`total description bytes grew ${old.descriptionBytes} → ${stats.descriptionBytes} (+${stats.descriptionBytes - old.descriptionBytes}). Every byte is billed to every engineer on every session, fired or not.`)
  }

  for (const [plugin, now] of Object.entries(stats.plugins)) {
    const was = old.plugins?.[plugin]
    if (!was) continue

    if (now.cases < was.cases) {
      warn(`plugins/${plugin}: case count fell ${was.cases} → ${now.cases}`)
    }
    if (now.graders < was.graders) {
      warn(`plugins/${plugin}: total graders fell ${was.graders} → ${now.graders}`)
    }
    // Density alone is a bad signal: a suite that legitimately expands with leaner
    // cases (exclusion cases carry one or two graders) drops density while the
    // absolute count rises. Only flag a drop that also breaches the documented floor.
    const densityNow = now.cases ? now.graders / now.cases : 0
    const densityWas = was.cases ? was.graders / was.cases : 0
    if (densityNow < 2.0 && densityNow < densityWas) {
      warn(`plugins/${plugin}: graders per case fell ${densityWas.toFixed(2)} → ${densityNow.toFixed(2)}, below the 2.0 floor`)
    }
    const llmNow = now.byType?.llm ?? 0
    const reNow = now.byType?.regex ?? 0
    const llmWas = was.byType?.llm ?? 0
    const reWas = was.byType?.regex ?? 0
    if (reNow < reWas && llmNow > llmWas) {
      warn(`plugins/${plugin}: regex ${reWas} → ${reNow} while llm ${llmWas} → ${llmNow} — strict graders traded for a softer judge (and judge calls cost money)`)
    }
    for (const [key, len] of Object.entries(now.patterns ?? {})) {
      const before = was.patterns?.[key]
      if (before !== undefined && len < before) {
        warn(`plugins/${plugin}/evals/${key}: regex pattern shortened ${before} → ${len} chars — verify it still asserts the same thing`)
      }
    }
  }
}

// ------------------------------------------------------------------ output ----

if (snapshotTo) {
  writeFileSync(path.resolve(ROOT, snapshotTo), JSON.stringify(stats, null, 2) + '\n')
  console.log(`audit-evals: snapshot written to ${snapshotTo}`)
}

console.log(
  `audit-evals: ${Object.keys(stats.plugins).length} plugins, ${stats.cases} cases, ` +
  `${stats.graders} graders, ${stats.descriptionBytes} description bytes`,
)

if (problems.length) {
  console.error(`\naudit-evals: ${problems.length} finding(s):`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log('audit-evals: OK')
