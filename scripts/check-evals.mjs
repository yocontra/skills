#!/usr/bin/env node
/**
 * check-evals.mjs — gate on plugin eval suites.
 *
 * Three rules, all statically checkable (no model calls, so this is free and
 * fast enough for pre-commit):
 *
 *   1. STRUCTURE  Every case under plugins/*\/evals/ parses: a prompt.md with a
 *                 non-empty body, known frontmatter keys only, a graders/
 *                 directory, known grader types, and compilable regexes.
 *
 *   2. SCORABLE   Every case has at least one grader that is not
 *                 `tool_used: Skill`. A two-arm run excludes Skill graders from
 *                 the score — they cannot pass in the no-plugin arm — so a case
 *                 graded only on "my skill fired" is scored on nothing.
 *
 *   3. COVERAGE   Every plugin has an eval suite, and every skill in it is
 *                 named by at least one `tool_used: Skill` grader. This is what
 *                 makes "a PR that adds or changes a skill must ship evals"
 *                 enforceable: add a skill without a routing case and this
 *                 fails.
 *
 * Plugins listed in evals-exempt.txt are skipped for rule 3 only. That file is
 * a shrinking baseline, not an escape hatch: a plugin that has a suite may not
 * stay listed, and the check fails if it does.
 *
 * Usage: node scripts/check-evals.mjs [--list-missing]
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLUGINS = path.join(ROOT, 'plugins')
const EXEMPT_FILE = path.join(ROOT, 'scripts', 'evals-exempt.txt')

const PROMPT_KEYS = new Set([
  'schema_version', 'name', 'description', 'tags', 'plugins', 'runs',
  'expected_outcome', 'model', 'max_turns', 'timeout_seconds', 'allowed_tools',
  'append_system_prompt', 'env',
])
const GRADER_KEYS = new Set([
  'type', 'weight', 'arm', 'name', 'target', 'focus', 'pattern', 'flags',
  'match', 'tool', 'input_match', 'min', 'max', 'before', 'after', 'path',
  'exists', 'criteria', 'baseline_file',
])
const GRADER_TYPES = new Set(['regex', 'tool_used', 'tool_order', 'file_exists', 'llm', 'baseline'])

const errors = []
const err = (msg) => errors.push(msg)

/** Split `---\n...\n---\n<body>`. Returns null when there is no frontmatter. */
function parseFrontmatter(file) {
  const src = readFileSync(file, 'utf8')
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return null
  const keys = {}
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || /^\s/.test(line) || line.trimStart().startsWith('#')) continue
    const i = line.indexOf(':')
    if (i < 0) continue
    keys[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return { keys, body: m[2] }
}

const unquote = (v) => v.replace(/^['"]|['"]$/g, '')

/**
 * `key: a: b` is invalid YAML, and so is `key: 'a' b` — a value that opens a
 * quote must be one whole quoted scalar. `claude plugin eval` refuses to load
 * either case.
 */
function checkPlainScalars(fm, label) {
  for (const [k, v] of Object.entries(fm.keys)) {
    if (v && !/^['"[{|>]/.test(v) && /:(\s|$)/.test(v)) {
      err(`${label}: "${k}" has an unquoted ": " in its value; quote the value`)
    }
    if (/^'/.test(v) && !/^'(?:[^']|'')*'(?:\s+#.*)?$/.test(v)) {
      err(`${label}: "${k}" starts with ' but is not one quoted string; quote the whole value`)
    }
    if (/^"/.test(v) && !/^"(?:[^"\\]|\\.)*"(?:\s+#.*)?$/.test(v)) {
      err(`${label}: "${k}" starts with " but is not one quoted string; quote the whole value`)
    }
  }
}

function dirs(p) {
  if (!existsSync(p)) return []
  return readdirSync(p).filter((e) => !e.startsWith('.') && statSync(path.join(p, e)).isDirectory())
}

/** The `name:` each SKILL.md declares — that is what a Skill call is keyed on. */
function skillNames(pluginDir) {
  const skillsDir = path.join(pluginDir, 'skills')
  const names = []
  for (const d of dirs(skillsDir)) {
    const f = path.join(skillsDir, d, 'SKILL.md')
    if (!existsSync(f)) continue
    const fm = parseFrontmatter(f)
    names.push(fm?.keys?.name ? unquote(fm.keys.name) : d)
  }
  return names
}

/** Validate one case directory. Returns the skill names its graders assert on. */
function checkCase(rel, caseDir) {
  const asserted = new Set()
  const promptFile = path.join(caseDir, 'prompt.md')
  const caseYaml = path.join(caseDir, 'case.yaml')

  if (!existsSync(promptFile) && !existsSync(caseYaml)) {
    err(`${rel}: neither prompt.md nor case.yaml`)
    return asserted
  }

  if (existsSync(promptFile)) {
    const fm = parseFrontmatter(promptFile)
    if (!fm) {
      err(`${rel}/prompt.md: no YAML frontmatter`)
    } else {
      checkPlainScalars(fm, `${rel}/prompt.md`)
      for (const k of Object.keys(fm.keys)) {
        if (!PROMPT_KEYS.has(k)) err(`${rel}/prompt.md: unknown frontmatter key "${k}"`)
      }
      if (!fm.body.trim()) err(`${rel}/prompt.md: empty prompt body`)
      if (fm.keys.plugins) {
        const target = path.resolve(caseDir, unquote(fm.keys.plugins.replace(/[[\]"']/g, '')))
        if (!existsSync(path.join(target, '.claude-plugin', 'plugin.json'))) {
          err(`${rel}/prompt.md: plugins path "${fm.keys.plugins}" does not resolve to a plugin`)
        }
      }

      // The built-in 10 turns / 300 seconds truncate real runs, and a truncated
      // run has no final message, so every last_message grader fails at once.
      if (Number(fm.keys.max_turns) < 30) {
        err(`${rel}/prompt.md: max_turns must be at least 30 (runs truncate below that, and a truncated run fails every grader)`)
      }
      if (Number(fm.keys.timeout_seconds) < 600) {
        err(`${rel}/prompt.md: timeout_seconds must be at least 600`)
      }
      // Without this, the model treats the bare sandbox as the user's real repo
      // and answers about that instead of doing the task. Run
      // `node scripts/normalize-evals.mjs` to apply the standard text.
      if (!(fm.keys.append_system_prompt ?? '').includes('Handle this request exactly as you normally would')) {
        err(`${rel}/prompt.md: missing the standard append_system_prompt — run \`node scripts/normalize-evals.mjs\``)
      }
      if (/\bAgent\b/.test(fm.keys.allowed_tools ?? '')) {
        err(`${rel}/prompt.md: do not grant Agent — a skill that fans out spawns real subagents, turning one case into a dozen runs`)
      }
    }
  }

  const gradersDir = path.join(caseDir, 'graders')
  const graderFiles = existsSync(gradersDir)
    ? readdirSync(gradersDir).filter((f) => f.endsWith('.md'))
    : []
  if (graderFiles.length === 0) {
    err(`${rel}: no graders/*.md`)
    return asserted
  }

  let scorable = 0
  for (const graderFile of graderFiles) {
    const graderLabel = `${rel}/graders/${graderFile}`
    const fm = parseFrontmatter(path.join(gradersDir, graderFile))
    if (!fm) { err(`${graderLabel}: no YAML frontmatter`); continue }
    checkPlainScalars(fm, graderLabel)

    const type = unquote(fm.keys.type ?? '')
    if (!GRADER_TYPES.has(type)) {
      err(`${graderLabel}: type "${type || '(missing)'}" is not one of ${[...GRADER_TYPES].join(', ')}`)
    }
    for (const k of Object.keys(fm.keys)) {
      if (!GRADER_KEYS.has(k)) err(`${graderLabel}: unknown grader key "${k}"`)
    }

    for (const k of ['pattern', 'input_match']) {
      if (!fm.keys[k]) continue
      try { new RegExp(unquote(fm.keys[k])) }
      catch (e) { err(`${graderLabel}: ${k} is not a valid regex: ${e.message}`) }
    }

    if (type === 'llm' && !fm.body.trim()) err(`${graderLabel}: llm grader has no criteria in its body`)
    // Without this clause the judge reads a correct answer's "I can't run
    // commands here" preamble as handing work back, and votes FAIL unanimously.
    if (type === 'llm' && !fm.body.includes('artifact of the sandbox')) {
      err(`${graderLabel}: llm grader is missing the no-shell clause — run \`node scripts/normalize-evals.mjs\``)
    }
    if (type === 'regex' && !fm.keys.pattern) err(`${graderLabel}: regex grader has no pattern`)
    if (type === 'tool_used' && !fm.keys.tool) err(`${graderLabel}: tool_used grader has no tool`)

    // A grader targeting the trace sees tool results, which include the loaded
    // SKILL.md. Asserting plugin-supplied text against the trace passes as soon
    // as the skill loads, which measures nothing beyond the Skill grader.
    if (unquote(fm.keys.target ?? '') === 'trace' && type === 'regex') {
      err(`${graderLabel}: regex over target: trace also matches the loaded SKILL.md text — grade last_message, or assert something the skill body does not contain`)
    }

    const isSkillGrader = type === 'tool_used' && unquote(fm.keys.tool) === 'Skill'
    if (!isSkillGrader) scorable++

    if (isSkillGrader && fm.keys.input_match) {
      for (const m of unquote(fm.keys.input_match).matchAll(/([a-z0-9][a-z0-9-]*)"?\s*$/gi)) {
        asserted.add(m[1])
      }
      const tail = unquote(fm.keys.input_match).match(/\)\?([a-z0-9-]+)"/i)
      if (tail) asserted.add(tail[1])
    }
  }

  if (scorable === 0) {
    err(`${rel}: every grader is \`tool_used: Skill\`, which a two-arm run excludes from the score — add a regex or llm grader`)
  }
  return asserted
}

// --------------------------------------------------------------- main ----

const exempt = new Set(
  existsSync(EXEMPT_FILE)
    ? readFileSync(EXEMPT_FILE, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)
    : [],
)

const missing = []
let caseCount = 0
let coveredPlugins = 0

for (const plugin of dirs(PLUGINS).sort()) {
  const pluginDir = path.join(PLUGINS, plugin)
  if (!existsSync(path.join(pluginDir, '.claude-plugin', 'plugin.json'))) continue

  const evalsDir = path.join(pluginDir, 'evals')
  const cases = dirs(evalsDir).filter(
    (c) => c !== 'results' &&
      (existsSync(path.join(evalsDir, c, 'prompt.md')) || existsSync(path.join(evalsDir, c, 'case.yaml'))),
  )

  if (cases.length === 0) {
    missing.push(plugin)
    if (!exempt.has(plugin)) {
      err(`plugins/${plugin}: no eval suite. Add plugins/${plugin}/evals/ — see CLAUDE.md "Evals".`)
    }
    continue
  }

  coveredPlugins++
  if (exempt.has(plugin)) {
    err(`scripts/evals-exempt.txt: "${plugin}" now has an eval suite — remove it from the exemption list`)
  }

  const asserted = new Set()
  for (const c of cases.sort()) {
    caseCount++
    for (const s of checkCase(`plugins/${plugin}/evals/${c}`, path.join(evalsDir, c))) asserted.add(s)
  }

  for (const skill of skillNames(pluginDir)) {
    if (!asserted.has(skill)) {
      err(`plugins/${plugin}: skill "${skill}" has no case asserting it fires. Add a \`tool_used: Skill\` grader whose input_match names it.`)
    }
  }
}

for (const stale of exempt) {
  if (!dirs(PLUGINS).includes(stale)) {
    err(`scripts/evals-exempt.txt: "${stale}" is not a plugin`)
  }
}

if (process.argv.includes('--list-missing')) {
  console.log(missing.join('\n'))
  process.exit(0)
}

const total = coveredPlugins + missing.length
console.log(
  `check-evals: ${coveredPlugins}/${total} plugins have suites, ${caseCount} cases` +
  (exempt.size ? `, ${exempt.size} exempt (pending)` : ''),
)

if (errors.length) {
  console.error(`\ncheck-evals: ${errors.length} error(s):`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
console.log('check-evals: OK')
