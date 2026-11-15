#!/usr/bin/env node
/**
 * lint-skill.mjs — static checks for one SKILL.md, a skill directory, or a plugin.
 *
 * Usage: node lint-skill.mjs <SKILL.md | skill dir | plugin dir> [--desc-max N] [--body-max N]
 *
 * Prints one line per finding (`path: RULE message`) and a summary. Exit 1 when
 * any finding is an error. No dependencies, so it runs in any repo.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const flag = (name, dflt) => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : dflt
}
const DESC_MAX = flag('--desc-max', 350)
const BODY_MAX = flag('--body-max', 500)
const target = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
if (!target) {
  console.error('usage: lint-skill.mjs <SKILL.md | skill dir | plugin dir>')
  process.exit(2)
}

const KNOWN_KEYS = new Set([
  'name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'allowed-tools',
  'disable-model-invocation', 'user-invocable', 'model', 'effort', 'context', 'agent',
  'background', 'hooks', 'paths', 'shell', 'license', 'metadata', 'version', 'compatibility',
])

const ANTIPATTERNS = [
  [/\b(CRITICAL|IMPORTANT|MANDATORY|WARNING|NEVER|ALWAYS|MUST|DO NOT)\b(?=[^a-z\n]{0,30}[:!])/g, 'all-caps emphasis'],
  [/\b(?:be (?:maximally|extremely|very) thorough|leave no stone|under no circumstances|at all costs|exhaustively)\b/gi, 'thoroughness booster'],
  [/\b(?:double[- ]check|verify twice|triple[- ]check|check your work|re-?verify|verify again)\b/gi, 'verification ritual'],
  [/\b(?:think step[- ]by[- ]step|chain[- ]of[- ]thought|ultrathink|think (?:carefully|hard|harder|deeply)|(?:show|write out|explain) your reasoning)\b|<thinking>/gi, 'reasoning scaffold'],
  [/(?<!["'`])\b(?:confirm (?:with the user )?before|ask the user\b|offer to|wait for (?:the user'?s? )?(?:approval|confirmation)|keep or edit\?)/gi, 'approval gate'],
  [/(?:^|[\s"'`(])\/(?:Users|home)\/[\w.-]+\//g, 'hard-coded home path'],
]

const findings = []
const add = (file, rule, msg, level = 'error') => findings.push({ file, rule, msg, level })

function skillFiles(p) {
  if (statSync(p).isFile()) return [path.resolve(p)]
  const out = []
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      if (n === 'node_modules' || n === '.git' || n === 'evals') continue
      const q = path.join(d, n)
      if (statSync(q).isDirectory()) walk(q)
      else if (n === 'SKILL.md') out.push(q)
    }
  }
  walk(path.resolve(p))
  return out.sort()
}

function mdFiles(dir, except) {
  const out = []
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const q = path.join(d, n)
      if (statSync(q).isDirectory()) walk(q)
      else if (n.endsWith('.md') && q !== except) out.push(q)
    }
  }
  walk(dir)
  return out
}

// A fenced block, backtick or tilde, possibly indented under a list item.
const FENCE = /^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1/gm

/** The description value, decoded from a plain, quoted, or block scalar. */
function description(fm) {
  const lines = fm.split(/\r?\n/)
  const i = lines.findIndex((l) => /^description:/.test(l))
  if (i < 0) return null
  const first = lines[i].replace(/^description:\s*/, '')
  const more = []
  for (const l of lines.slice(i + 1)) {
    if (/^\S/.test(l)) break
    more.push(l.trim())
  }
  if (/^[>|]/.test(first)) return { kind: 'block', text: more.filter(Boolean).join(' ') }
  const raw = [first, ...more].filter(Boolean).join(' ').trim()
  const q = raw[0]
  if (q === '"' || q === "'") {
    const closed = raw.length > 1 && raw.endsWith(q)
    return { kind: 'quoted', text: closed ? raw.slice(1, -1) : raw, closed }
  }
  return { kind: 'plain', text: raw }
}

function links(text, fromDir) {
  const out = new Set()
  const prose = text.replace(FENCE, '')
  for (const m of prose.matchAll(/]\(\s*([^)\s#]+\.[A-Za-z0-9]+)(?:#[^)\s]*)?\s*\)/g)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(m[1]) || m[1].startsWith('$')) continue
    out.add(path.resolve(fromDir, m[1]))
  }
  return out
}

const files = skillFiles(target)
if (!files.length) {
  console.error(`no SKILL.md under ${target}`)
  process.exit(2)
}

for (const file of files) {
  const rel = path.relative(process.cwd(), file)
  const dir = path.dirname(file)
  const src = readFileSync(file, 'utf8')
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) {
    add(rel, 'FRONTMATTER', 'no --- delimited frontmatter')
    continue
  }
  const [, fm, body] = m
  const keys = {}
  for (const line of fm.split(/\r?\n/)) {
    const k = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (k) keys[k[1]] = k[2]
  }
  for (const k of Object.keys(keys)) {
    if (k === 'references') add(rel, 'FRONTMATTER', '`references:` is not a recognized key; link the files from the body')
    else if (!KNOWN_KEYS.has(k)) add(rel, 'FRONTMATTER', `unknown key \`${k}\``, 'warn')
  }
  if (!keys.name) add(rel, 'FRONTMATTER', 'missing `name`', 'warn')
  if (keys.name && keys.name !== path.basename(dir)) {
    add(rel, 'FRONTMATTER', `name \`${keys.name}\` differs from directory \`${path.basename(dir)}\``, 'warn')
  }
  if (!('effort' in keys)) add(rel, 'FRONTMATTER', 'no `effort:` set', 'warn')

  const d = description(fm)
  const desc = d ? d.text.trim() : ''
  if (!desc) add(rel, 'DESCRIPTION', 'missing description')
  else {
    if (desc.length > DESC_MAX) add(rel, 'DESCRIPTION', `${desc.length} chars (budget ${DESC_MAX})`)
    if (d.kind === 'plain' && /: /.test(desc)) add(rel, 'DESCRIPTION', 'unquoted value contains ": " — invalid YAML; quote it or rephrase')
    if (d.kind === 'quoted' && !d.closed) add(rel, 'DESCRIPTION', 'starts with a quote but does not end with one — invalid YAML; quote the whole value or rephrase')
  }

  const lines = body.split(/\r?\n/).length
  if (lines > BODY_MAX) add(rel, 'BODY', `${lines} lines (budget ${BODY_MAX}) — move lookup material to references/`)

  const refs = mdFiles(dir, file)
  const reached = new Set()
  const queue = [...links(body, dir)]
  while (queue.length) {
    const t = queue.pop()
    if (reached.has(t)) continue
    reached.add(t)
    if (!existsSync(t)) {
      add(rel, 'LINK', `broken link → ${path.relative(dir, t)}`)
      continue
    }
    if (t.endsWith('.md') && statSync(t).isFile()) queue.push(...links(readFileSync(t, 'utf8'), path.dirname(t)))
  }
  for (const r of refs) {
    if (!reached.has(r)) add(rel, 'UNREACHABLE', `${path.relative(dir, r)} is never linked, so it is never loaded`)
  }

  // Line numbers are reported against the whole file, frontmatter included.
  const bodyOffset = src.slice(0, src.length - body.length).split('\n').length - 1
  for (const t of [file, ...refs]) {
    const text = t === file ? body : readFileSync(t, 'utf8')
    const offset = t === file ? bodyOffset : 0
    const lineOf = (i) => text.slice(0, i).split('\n').length + offset
    const fenced = [...text.matchAll(FENCE)].map((f) => [f.index, f.index + f[0].length])
    const inFence = (i) => fenced.some(([a, b]) => i >= a && i < b)
    for (const [re, why] of ANTIPATTERNS) {
      for (const hit of text.matchAll(re)) {
        const soft = why === 'approval gate' || why === 'hard-coded home path'
        // Examples in code blocks are illustrations, not instructions.
        if (soft && inFence(hit.index)) continue
        // "do not ask the user", "never offer to …", "only if the user names one" are
        // the opposite of a gate, as is a clause scoped to a missing credential.
        // Look back to the start of the sentence or list item, across hard-wrapped lines.
        const window = text.slice(Math.max(0, hit.index - 400), hit.index)
        const starts = [...window.matchAll(/[.!?](?=\s)|\n[ \t]*\n|\n[ \t]*(?:[-*+]|\d+\.)[ \t]/g)]
        const last = starts.at(-1)
        const before = last ? window.slice(last.index + last[0].length) : window
        if (why === 'approval gate' && /\b(?:not|never|don'?t|no need to|without|instead of|rather than)\b/i.test(before)) continue
        add(rel, 'ANTIPATTERN', `${path.relative(dir, t)}:${lineOf(hit.index)} "${hit[0].trim()}" — ${why}`, soft ? 'warn' : 'error')
      }
    }
  }

  const WORDS = { four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }
  const fan = Math.max(0, ...[...body.matchAll(/(\d+|four|five|six|seven|eight|nine|ten|eleven|twelve)[\s-]+parallel[\s-]+(?:agents|subagents)/gi)]
    .map((x) => WORDS[x[1].toLowerCase()] ?? Number(x[1])))
  if (fan >= 4 && !(/\bmodel\b/i.test(body) && /\bcost\b/i.test(body))) {
    add(rel, 'FANOUT', 'declares parallel agents but documents no model knob and no cost note', 'warn')
  }
}

for (const f of findings) console.log(`${f.level === 'error' ? 'ERROR' : 'warn '} ${f.file}: ${f.rule} ${f.msg}`)
const errs = findings.filter((f) => f.level === 'error').length
console.log(`\n${files.length} skill(s), ${errs} error(s), ${findings.length - errs} warning(s)`)
process.exit(errs ? 1 : 0)
