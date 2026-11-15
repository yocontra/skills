#!/usr/bin/env node
/**
 * normalize-evals.mjs — bring every eval case up to the house standard.
 *
 * Six agents authored 176 cases from the same spec and still drifted, so this
 * applies the two things that are non-negotiable and easy to omit:
 *   - the standard `append_system_prompt`, plus generous run limits
 *   - the no-shell clause every `llm` rubric needs, ahead of its criteria, or
 *     the judge reads a correct answer's "I can't run commands here" preamble
 *     as a failure
 *
 * Idempotent. Run it, then `node scripts/check-evals.mjs`.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLUGINS = path.join(ROOT, 'plugins')

export const APPEND_SYSTEM_PROMPT =
  'append_system_prompt: "Handle this request exactly as you normally would, following ' +
  'whatever process and references apply to it. Two differences in this environment: no shell ' +
  'is available, so commands cannot execute; and the working directory is bare scaffolding, so ' +
  "ignore its contents and anything outside it rather than treating them as the user's real " +
  'project. The real project exists but is not visible here, so an empty directory never means ' +
  'there is nothing to do: use whatever skill or process applies and carry it through. ' +
  'When you reach a step that needs a command, write out the exact command and keep ' +
  'going. Never stop to ask for tools or permissions, and always finish with your complete approach."'

export const NO_SHELL_CLAUSE = [
  'This environment has no shell and its working directory is empty scaffolding, so no',
  'response can run commands, read the real project, or report real results here. Do not',
  'fail a response for not executing, for declining to invent results, or for offering to',
  'finish against the real project; ignore any preamble about missing tools or files, which',
  'is an artifact of the sandbox, not the behavior under test. Grade only the process the',
  'response describes.',
].join('\n')

export const CLAUSE_MARKER = 'artifact of the sandbox'

const split = (src) => src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)

function dirs(p) {
  if (!existsSync(p)) return []
  return readdirSync(p).filter((e) => !e.startsWith('.') && statSync(path.join(p, e)).isDirectory())
}

let prompts = 0
let graders = 0

for (const plugin of dirs(PLUGINS)) {
  const evalsDir = path.join(PLUGINS, plugin, 'evals')
  for (const c of dirs(evalsDir)) {
    if (c === 'results') continue
    const caseDir = path.join(evalsDir, c)

    const promptFile = path.join(caseDir, 'prompt.md')
    if (existsSync(promptFile)) {
      const src = readFileSync(promptFile, 'utf8')
      const m = split(src)
      if (m) {
        const keep = m[1]
          .split('\n')
          .filter((l) => !/^(max_turns|timeout_seconds|append_system_prompt):/.test(l))
        const next = `---\n${[...keep, 'max_turns: 30', 'timeout_seconds: 600', APPEND_SYSTEM_PROMPT].join('\n')}\n---\n${m[2]}`
        if (next !== src) { writeFileSync(promptFile, next); prompts++ }
      }
    }

    const gradersDir = path.join(caseDir, 'graders')
    if (!existsSync(gradersDir)) continue
    for (const g of readdirSync(gradersDir).filter((f) => f.endsWith('.md'))) {
      const file = path.join(gradersDir, g)
      const src = readFileSync(file, 'utf8')
      const m = split(src)
      if (!m || !/type:\s*llm/.test(m[1])) continue
      // The clause goes ahead of the criteria: placed after them, the judge had
      // already failed an answer for its sandbox preamble before reading it.
      const paras = m[2].trim().split(/\n\s*\n/).filter((p) => !p.includes(CLAUSE_MARKER))
      const lead = paras[0] === 'Judge only the response text.' ? [paras.shift()] : []
      const next = `---\n${m[1]}\n---\n${[...lead, NO_SHELL_CLAUSE, ...paras].join('\n\n')}\n`
      if (next !== src) { writeFileSync(file, next); graders++ }
    }
  }
}

console.log(`normalize-evals: ${prompts} prompt(s), ${graders} llm grader(s) updated`)
