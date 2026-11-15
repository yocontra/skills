export const meta = {
  name: 'uplift',
  description: 'Audit a repo for agent readiness (inventory + verify). Returns structured findings; the launcher reports, plans, and applies the uplift changes.',
  phases: [
    { title: 'Inventory', detail: 'Scan manifests, code, and configs to identify every requirement' },
    { title: 'Verify', detail: 'Probe each requirement in parallel' },
  ],
}

const INVENTORY_SCHEMA = {
  type: 'object',
  required: ['requirements', 'plugin_recommendations', 'dev_loop', 'claude_md', 'project_skills'],
  properties: {
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        required: ['category', 'name', 'evidence', 'blocker'],
        properties: {
          category: { type: 'string' },
          name: { type: 'string' },
          evidence: { type: 'string' },
          blocker: { type: 'boolean' },
        },
      },
    },
    plugin_recommendations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['plugin', 'evidence', 'settings_line'],
        properties: {
          plugin: { type: 'string' },
          evidence: { type: 'string' },
          settings_line: { type: 'string' },
        },
      },
    },
    dev_loop: {
      type: 'object',
      properties: {
        setup: { type: ['string', 'null'] },
        build: { type: ['string', 'null'] },
        test: { type: ['string', 'null'] },
        lint: { type: ['string', 'null'] },
        run: { type: ['string', 'null'] },
        ci_source_of_truth: { type: ['string', 'null'] },
      },
    },
    claude_md: {
      type: 'object',
      properties: {
        present: { type: 'boolean' },
        path: { type: ['string', 'null'] },
        line_count: { type: ['number', 'null'] },
        rubric_gaps: { type: 'array', items: { type: 'string' } },
      },
    },
    project_skills: {
      type: 'object',
      properties: {
        directory_present: { type: 'boolean' },
        skills: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              path: { type: 'string' },
            },
          },
        },
        table_in_claude_md: { type: 'boolean' },
        mismatches: { type: 'array', items: { type: 'string' } },
        recurring_concerns: { type: 'array', items: { type: 'string' } },
      },
    },
  },
}

const PROBE_RESULT_SCHEMA = {
  type: 'object',
  required: ['category', 'name', 'status', 'evidence'],
  properties: {
    category: { type: 'string' },
    name: { type: 'string' },
    status: {
      type: 'string',
      enum: ['OK', 'STALE', 'UNAUTH', 'MISSING', 'NOT_INTEGRATED', 'RECOMMEND', 'WARN', 'WEAK', 'UNKNOWN'],
    },
    probe_command: { type: ['string', 'null'] },
    evidence: { type: 'string' },
    remediation: { type: ['string', 'null'] },
  },
}

const { scope, mode, promptsDir, pluginRoot } = args
// Optional model for the verify fan-out (one agent per requirement). Omitted,
// verify agents run on the session's model and can share its prompt cache.
const VERIFY_MODEL = args.verifyModel || null

if (!pluginRoot) {
  throw new Error('pluginRoot is required (absolute path to the agent-ready plugin root). The launcher must resolve ${CLAUDE_PLUGIN_ROOT} and pass it.')
}

// Inventory is the single point of failure: a null/errored result aborts the
// whole run with zero requirements. Retry once before giving up.
const withRetry = async (thunk) => {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await thunk()
      if (r) return r
    } catch {
      // retry once; a second failure returns null and trips the abort guard
    }
  }
  return null
}

// Cap the verify fan-out so a large project does not spawn one concurrent
// agent per requirement all at once.
const MAX_CONC = 16

phase('Inventory')
const inventory = await withRetry(() =>
  agent(
    [
      `Project root: ${scope.rootDescription}.`,
      `Plugin root: ${pluginRoot} -- wherever a referenced file says \${CLAUDE_PLUGIN_ROOT} or <PLUGIN_ROOT>, use this absolute path.`,
      `Constrained scope: ${scope.constrained ? JSON.stringify(scope.files) : 'no -- enumerate the full project'}.`,
      `Read ${promptsDir}/inventory.md and follow it exactly.`,
    ].join('\n'),
    { schema: INVENTORY_SCHEMA, label: 'inventory', effort: 'medium' }
  )
)

if (!inventory) {
  log('Inventory agent returned no result after a retry -- aborting. Rerun uplift; if persistent, scope with --service to isolate.')
  return { inventory: null, probe_results: [], coverage_gaps: ['Inventory (agent did not run)'], mode: mode || 'text' }
}

log(`Inventory: ${inventory.requirements.length} requirements, ${inventory.plugin_recommendations.length} plugin recommendations`)

if (inventory.requirements.length === 0) {
  log('Inventory found zero requirements -- this is unusual. Verify scope.rootDescription points at a real project.')
  return { inventory, probe_results: [], coverage_gaps: [], mode: mode || 'text' }
}

const flags = args.flags || {}
let requirements = inventory.requirements
if (flags.quick) {
  // Category names must match what the inventory agent emits (see
  // workflows/uplift/prompts/inventory.md), not the launcher's report vocabulary.
  const keep = new Set(['Tooling', 'Auth', 'Sandbox permission'])
  requirements = requirements.filter((req) => keep.has(req.category))
}
if (flags.service) {
  const needle = String(flags.service).toLowerCase()
  requirements = requirements.filter((req) =>
    `${req.category} ${req.name} ${req.evidence}`.toLowerCase().includes(needle))
}
if (flags.quick || flags.service) {
  log(`Flags narrowed verify to ${requirements.length}/${inventory.requirements.length} requirements`)
}

phase('Verify')
// Matches the launcher's stated estimate: about 2 minutes plus a minute per 16
// requirements. Advisory only; the runtime has no clock, so agents get the figure.
const budgetSeconds = 120 + 60 * Math.ceil(requirements.length / MAX_CONC)
const raw_results = []
for (let w = 0; w < requirements.length; w += MAX_CONC) {
  const wave = requirements.slice(w, w + MAX_CONC)
  const waveResults = await parallel(
    wave.map((req) => () =>
      agent(
        [
          `Plugin root: ${pluginRoot} -- wherever a referenced file says \${CLAUDE_PLUGIN_ROOT} or <PLUGIN_ROOT>, use this absolute path.`,
          `Project root: ${scope.rootDescription} -- the project under audit. Run every filesystem probe against this path (a repo-relative file like CLAUDE.md, Makefile, .claude/, .claude/settings.json means THIS root, not your current working directory). Use absolute paths under it.`,
          `Read ${promptsDir}/verify.md and follow it.`,
          `Time: verify budget ${budgetSeconds}s for the whole run (advisory); your probe is still capped at 5s.`,
          `Probe this requirement: ${JSON.stringify(req)}.`,
        ].join('\n'),
        {
          schema: PROBE_RESULT_SCHEMA,
          label: `verify:${req.category}:${req.name}`,
          effort: 'low',
          ...(VERIFY_MODEL ? { model: VERIFY_MODEL } : {}),
        }
      )
    )
  )
  raw_results.push(...waveResults)
  if (requirements.length > MAX_CONC) {
    log(`Verify wave ${Math.floor(w / MAX_CONC) + 1}/${Math.ceil(requirements.length / MAX_CONC)} done`)
  }
}

const probe_results = raw_results.map((result, i) => {
  if (result) return result
  const req = requirements[i]
  return {
    category: req.category,
    name: req.name,
    status: 'UNKNOWN',
    probe_command: null,
    evidence: 'verify agent returned no result (failed, errored, or was skipped)',
    remediation: 'rerun uplift; if persistent, scope with --service to isolate',
    _agent_failure: true,
  }
})

// A probe that never ran is distinct from one that ran and was indeterminate.
// Surface the failures so the launcher can flag them rather than letting a
// BLOCKED project read as DEGRADED on the back of silent agent failures.
const coverage_gaps = probe_results
  .filter((r) => r._agent_failure)
  .map((r) => `${r.category}.${r.name}`)
log(`Verify: ${probe_results.length} probes returned (${coverage_gaps.length} agent failures -> coverage gaps)`)

return {
  inventory,
  probe_results,
  coverage_gaps,
  mode: mode || 'text',
}
