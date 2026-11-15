#!/usr/bin/env node
/**
 * check-cost.mjs — gate on the per-token cost of skills.
 *
 * Every skill in this marketplace has two sharply different price tags:
 *
 *   - Its `description` is loaded into the system prompt of EVERY session, for
 *     every user, whether or not the skill ever fires. 82 skills * a bloated
 *     description is a permanent tax on every conversation in the org.
 *   - Its SKILL.md body is loaded in full the moment the skill fires. A skill
 *     that inlines its reference material makes the caller pay for the 90% they
 *     did not need.
 *
 * Four rules, all statically checkable (no model calls, so this is free and
 * fast enough for pre-commit):
 *
 *   1. DESCRIPTION  <= MAX_DESC chars. The description is routing metadata, not
 *                   documentation: enough trigger words to fire correctly, and
 *                   nothing else. Detail belongs in the body.
 *
 *   2. BODY         <= MAX_BODY lines, the limit the Skills docs recommend.
 *                   Past that, split the tail into references/*.md and link to
 *                   it. The body should hold the decision procedure; references
 *                   hold the lookup tables, endpoint catalogs, and worked
 *                   examples the model reads only when it actually needs them.
 *
 *   3. REFERENCES   Progressive disclosure only works through Markdown links in
 *                   the body. `references:` is NOT a recognized SKILL.md
 *                   frontmatter key — Claude Code ignores it, so a file listed
 *                   there and nowhere else is invisible to the model. Every .md
 *                   under a skill directory must be reachable by a link from
 *                   SKILL.md (or from another reference), and every such link
 *                   must resolve or the model burns a turn on a failed Read.
 *
 *   4. FAN-OUT      A skill that fans out to MAX_FANOUT+ parallel agents must
 *                   document a model knob and the cost tradeoff. Fan-out is the
 *                   single largest cost multiplier we ship: N agents each pay
 *                   full system prompt + context. If a skill spends that much,
 *                   the caller gets to see the bill and to downshift the fleet
 *                   to a cheaper model. plugins/gh/skills/monitor-pr is the
 *                   reference implementation (`fixModel` + a Cost section).
 *
 *   5. ANTIPATTERN  Prompting rituals that frontier models take literally and
 *                   bill you for. Anthropic's cost guidance measured a 14.6%
 *                   cost drop AND a 5.3% accuracy gain from removing these on a
 *                   model migration:
 *                     - verification rituals ("double-check", "verify twice")
 *                     - emphasis boosters ("CRITICAL:", "be maximally thorough")
 *                     - scratchpad / chain-of-thought scaffolds
 *                   The model already reasons. Telling it to reason costs
 *                   tokens and makes the answer worse.
 *
 *                   The fix is to rewrite, not to delete. A real safety warning
 *                   stays — it just stops shouting. "WARNING: this is
 *                   destructive!" becomes "This deletes the folder and cannot
 *                   be undone." Same meaning, no emphasis tax. If you drop the
 *                   caveat entirely you have traded a cost bug for a safety bug.
 *                   See https://claude.com/blog/reducing-cost-and-improving-performance-with-claude-platform
 *
 * Rules that are policy but not statically checkable live in CLAUDE.md under
 * "Cost". Reviewers enforce those; this script enforces what a regex can see.
 *
 * cost-baseline.txt lists pre-existing violations, `path:RULE` per line. It is
 * a shrinking baseline, not an escape hatch: the check fails if a listed
 * violation has been fixed but left in the file, so the list can only get
 * smaller. Skills synced from external packages (`make sync`) are marked as
 * vendored there and stay — we do not own their source.
 *
 * Usage:
 *   node scripts/check-cost.mjs              # gate
 *   node scripts/check-cost.mjs --list       # print every violation, exit 0
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_FILE = path.join(ROOT, 'scripts', 'cost-baseline.txt')

const MAX_DESC = 350
const MAX_BODY = 500
const MAX_FANOUT = 4

/**
 * Prompting anti-patterns, per Anthropic's cost guidance. Deliberately narrow:
 * all-caps emphasis headers ("CRITICAL:", "NEVER!"), not ordinary prose that
 * happens to contain "always". A wide net here would be pure noise and the
 * gate would get ignored.
 */
const ANTIPATTERNS = [
  [/\b(CRITICAL|IMPORTANT|MANDATORY|WARNING|NEVER|ALWAYS|MUST|DO NOT)\b(?=[^a-z\n]{0,30}[:!])/g,
    'all-caps emphasis booster — frontier models read plain prose fine, and shouting buys extra tool calls'],
  [/\b(?:be (?:maximally|extremely|very) thorough|leave no stone|under no circumstances|at all costs|exhaustively)\b/gi,
    'thoroughness booster — reads as "spend more tokens"'],
  [/\b(?:double[- ]check|verify twice|triple[- ]check|check your work|re-?verify|verify again)\b/gi,
    'verification ritual — taken literally, it duplicates work'],
  [/\b(?:think step[- ]by[- ]step|chain[- ]of[- ]thought|ultrathink|think (?:carefully|hard|harder|deeply)|(?:show|write out|explain) your reasoning)\b|<thinking>/gi,
    'reasoning scaffold — stacks on top of native reasoning'],
]

const WORD_NUM = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}

const violations = []
const add = (rel, rule, msg) => violations.push({ key: `${rel}:${rule}`, rel, rule, msg })

/** Split `---\n...\n---\n<body>`. Returns { desc, body } with body line-addressable. */
function parse(file) {
  const src = readFileSync(file, 'utf8')
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { desc: '', body: src }
  const fm = m[1]
  // description: may be a folded multi-line scalar; take everything up to the
  // next top-level key.
  // `$` under the m flag would stop at the first line end, so look ahead for the
  // next key or the true end of the frontmatter instead.
  const d = fm.match(/^description:[ \t]*([\s\S]*?)(?=\n[A-Za-z][\w-]*:|(?![\s\S]))/m)
  let desc = d ? d[1].trim() : ''
  if (/^[>|][+-]?\s/.test(desc + ' ')) desc = desc.replace(/^[>|][+-]?/, '')
  desc = desc.replace(/^(["'])([\s\S]*)\1$/, '$2').replace(/\s+/g, ' ').trim()
  return { desc, body: m[2] }
}

/** Every SKILL.md under plugins/ and .claude/skills/, repo-relative. */
function skillFiles() {
  const out = []
  const walk = (dir) => {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name === 'SKILL.md') out.push(p)
    }
  }
  walk(path.join(ROOT, 'plugins'))
  walk(path.join(ROOT, '.claude', 'skills'))
  return out.sort()
}

/** Local .md link targets in a markdown body, resolved against its own dir. */
function localMdLinks(body, fromDir) {
  const out = new Set()
  for (const m of body.matchAll(/]\(\s*([^)\s#]+\.md)(?:#[^)\s]*)?\s*\)/g)) {
    const target = m[1]
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue // absolute URL
    out.add(path.resolve(fromDir, target))
  }
  return out
}

/** All .md files under a skill dir except SKILL.md itself. */
function referenceFiles(skillDir) {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.md') && p !== path.join(skillDir, 'SKILL.md')) out.push(p)
    }
  }
  walk(skillDir)
  return out
}

/** Largest declared parallel-agent fan-out mentioned in a body, or 0. */
function declaredFanout(body) {
  let max = 0
  const re = /(?:up to\s+)?(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[\s-]+parallel[\s-]+(?:agents|subagents)/gi
  for (const m of body.matchAll(re)) {
    const raw = m[1].toLowerCase()
    const n = WORD_NUM[raw] ?? Number.parseInt(raw, 10)
    if (Number.isFinite(n)) max = Math.max(max, n)
  }
  return max
}

for (const file of skillFiles()) {
  const rel = path.relative(ROOT, file)
  const dir = path.dirname(file)
  const { desc, body } = parse(file)

  if (desc.length > MAX_DESC) {
    add(rel, 'DESCRIPTION', `description is ${desc.length} chars (max ${MAX_DESC}) — it is loaded into every session`)
  }

  const lines = body.split(/\r?\n/).length
  if (lines > MAX_BODY) {
    add(rel, 'BODY', `body is ${lines} lines (max ${MAX_BODY}) — move lookup tables and examples into references/`)
  }

  // Rule 3, both directions. Reachability is transitive: SKILL.md -> ref -> ref.
  const refs = referenceFiles(dir)
  const reachable = new Set()
  const queue = [...localMdLinks(body, dir)]
  const broken = []
  while (queue.length) {
    const target = queue.pop()
    if (reachable.has(target)) continue
    if (!existsSync(target)) {
      broken.push(path.relative(ROOT, target))
      continue
    }
    reachable.add(target)
    if (target.endsWith('.md')) {
      for (const next of localMdLinks(readFileSync(target, 'utf8'), path.dirname(target))) queue.push(next)
    }
  }
  const orphans = refs.filter((r) => !reachable.has(r)).map((r) => path.relative(ROOT, r))
  if (broken.length || orphans.length) {
    const parts = []
    if (broken.length) parts.push(`broken links: ${broken.join(', ')}`)
    if (orphans.length) parts.push(`unlinked (never loaded): ${orphans.join(', ')}`)
    add(rel, 'REFERENCES', parts.join('; '))
  }

  const fanout = declaredFanout(body)
  if (fanout >= MAX_FANOUT && !(/\bmodel\b/i.test(body) && /\bcost\b/i.test(body))) {
    add(rel, 'FANOUT', `fans out to ${fanout} parallel agents but documents no model knob and no cost note`)
  }

  // Rule 5. Scan the body and every reference file the skill ships — the model
  // pays for an anti-pattern wherever it reads it.
  const hits = []
  for (const target of [file, ...refs]) {
    const text = target === file ? body : readFileSync(target, 'utf8')
    for (const [re, why] of ANTIPATTERNS) {
      for (const m of text.matchAll(re)) {
        hits.push(`${path.relative(dir, target)}: "${m[0]}" — ${why}`)
      }
    }
  }
  if (hits.length) {
    const shown = hits.slice(0, 3).join('; ')
    add(rel, 'ANTIPATTERN', `${hits.length} prompting anti-pattern(s): ${shown}${hits.length > 3 ? '; …' : ''}`)
  }
}

const baseline = existsSync(BASELINE_FILE)
  ? readFileSync(BASELINE_FILE, 'utf8')
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim())
      .filter(Boolean)
  : []

if (process.argv.includes('--list')) {
  for (const v of violations) {
    console.log(`${baseline.includes(v.key) ? 'baselined' : 'NEW      '} ${v.key}  ${v.msg}`)
  }
  console.log(`\n${violations.length} violations, ${violations.filter((v) => !baseline.includes(v.key)).length} new`)
  process.exit(0)
}

const live = new Set(violations.map((v) => v.key))
const errors = []

for (const v of violations) {
  if (!baseline.includes(v.key)) errors.push(`${v.rel} [${v.rule}] ${v.msg}`)
}
for (const key of baseline) {
  if (!live.has(key)) {
    errors.push(`${key} is listed in scripts/cost-baseline.txt but no longer violates — delete the line`)
  }
}

if (!errors.length) {
  console.log(`check-cost: ok (${baseline.length} baselined violations remaining)`)
  process.exit(0)
}

console.error('check-cost: FAILED\n')
for (const e of errors) console.error(`  - ${e}`)
console.error(`
Budgets: description <= ${MAX_DESC} chars, body <= ${MAX_BODY} lines,
references linked both ways, ${MAX_FANOUT}+ parallel agents needs a model knob and a cost note.
See "Cost" in CLAUDE.md. Run \`node scripts/check-cost.mjs --list\` for the full picture.`)
process.exit(1)
