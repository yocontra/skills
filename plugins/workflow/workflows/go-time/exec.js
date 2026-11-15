export const meta = {
  name: 'go-time-exec',
  description: 'Implement a task list: dependency-ordered parallel implementers (file-partitioned). With audit on, a 5-way review+audit and a fix loop until clean. Never runs git; the launcher commits, pushes and opens the PR.',
  phases: [
    { title: 'Implement', detail: 'dependency-ordered parallel implementers (<=5), file-partitioned' },
    { title: 'Review', detail: 'audit only: 2 staff reviews + bug/security/perf audits in parallel' },
    { title: 'Fix', detail: 'audit only: fix surfaced issues and re-review until all pass' },
  ],
}

/* ─── Operations ─────────────────────────────────────────
 * Phases (capped MAX_IMPL=5, FIX_CAP default 3):
 *   Implement  → waves of ≤5 implementers, dep-ordered, file-owned (skipped if !TASKS.length)
 *   Review     → audit only: 5 parallel single-pass reviewers: completeness, quality,
 *                bug-audit, security-scan, perf-audit (each reads ${promptsDir}/<role>.md)
 *   Fix        → audit only: one agent per affected file (parallel), then loop back to
 *                Review until clean OR round == FIX_CAP. Skipped when Review yields 0 issues.
 *
 * Fan-out: ≈ ceil(tasks/5)*5 (impl); with audit add (5 + N_files) * (FIX_CAP+1).
 *
 * args = {
 *   planText, tasks: [{id, text, files:[abs paths], deps:[ids]}],
 *   audit (default false; true for large features), fixCap (default 3),
 *   model (optional implementer/fix model; reviewers keep the session model),
 *   repoRoot (absolute worktree path; relative file paths resolve against it),
 *   testCmd (optional: the repo's test command, passed to implementers and fixers)
 * }
 *
 * The protocols in prompts/*.md are inlined below by scripts/sync-workflow-prompts.mjs,
 * so agents skip a file read and each phase shares a byte-identical prompt prefix.
 * Edit the .md, then run the sync script.
 *
 * Smoke-test args (no tasks, review only — fix agents WILL edit, so use a clean tree):
 *   { planText: "noop", tasks: [], audit: true, fixCap: 0, repoRoot: "/abs/worktree" }
 *
 * Mutating phases write to the working tree, never to git:
 *   Implement → owned files per task         Fix → one file per agent
 *
 * Common failure modes:
 *   - impl returns done!=true → status='failed' → downstream deps 'blocked' → NEEDS ATTENTION.
 *   - A reviewer that fails twice is recorded in failedDimensions (coverage gap), NOT clean.
 *   - Two tasks claiming the same file in one wave → second waits for the next wave.
 *   - Dep cycle in tasks → scheduler logs and dispatches anyway to avoid deadlock.
 *
 * Quick checkin recipe:
 *   jq -c 'select(.label|test("^impl:|^review:|^fix:"))' .claude/runs/<id>/journal.jsonl
 * ─────────────────────────────────────────────────────── */

const A = (typeof args === 'object' && args) ? args : {}
const PLAN = A.planText || ''
const TASKS = A.tasks || []
const MAX_IMPL = 5
const FIX_CAP = A.fixCap ?? 3
const AUDIT = A.audit === true
const MODEL = A.model ? { model: A.model } : {}
const ROOT = A.repoRoot || ''
const TEST_LINE = A.testCmd ? `\nTEST COMMAND: ${A.testCmd} (narrow it while you iterate; run it in full before you report)\n` : ''

// One spelling per file, so `src/a.py`, `./src/a.py` and `/repo/src/a.py` never
// get two parallel agents. Resolves against repoRoot and collapses `.`, `..` and
// repeated slashes. The runtime has no filesystem, so symlinks are not resolved.
const normPath = (p) => {
  const raw = String(p)
  const abs = raw.startsWith('/') ? raw : ROOT ? `${ROOT}/${raw}` : raw
  const out = []
  for (const seg of abs.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return (abs.startsWith('/') ? '/' : '') + out.join('/')
}

// prompt-sync:begin prompts/implement-task.md
const IMPLEMENT_PROTOCOL = `# Implementer Protocol

You are implementing a single task from an approved implementation plan. Other implementers are working on other tasks in parallel — stay strictly inside your file boundaries.

## Rules

- **Do NOT run ANY git command.** No \`git add\`, \`git commit\`, \`git checkout\`, \`git branch\`, \`git stash\`, \`git rebase\`, nothing. The launcher owns all git operations. Workers that touch git get stuck in conflicts and rebase loops.
- **Only modify files you own.** Files outside your task's \`FILES YOU OWN\` list belong to other implementers. Do not read them speculatively, do not edit them, do not create new files at paths assigned to other tasks.
- **Write tests with the implementation.** Target 80%+ coverage with a mix of unit, integration, and e2e tests. Do not mock services when the real service is reachable in the test environment.
- **Bugfixes require a regression test** that fails without the fix and passes with it. No exceptions.
- **Run the tests before finishing**, with the \`TEST COMMAND\` when one is given, else the command the repo's CLAUDE.md, AGENTS.md or CONTRIBUTING.md names. Do not report \`done: true\` if tests are red or untried.
- **Leave no scratch behind.** Put scratch files in a \`mktemp -d\` directory and delete it before you report; stop any server or watcher you started. Never delete files you did not create.

## What you receive

- \`TASK <id>\` — the full task text from the plan, including success criteria.
- \`FILES YOU OWN\` — the exact paths you may modify.
- \`PLAN CONTEXT\` — the surrounding plan (truncated). Use it to understand intent and how your task fits with others; do not modify files outside your ownership even if the plan describes them.

## What you return

A structured result indicating whether the task is fully implemented:

- \`done: true\` only when the task's success criteria are met, the code is written, and tests pass.
- \`done: false\` if anything is incomplete, blocked, or untested.
- \`summary\` — one short sentence describing what changed (or what blocked you).
- \`files\` — paths you actually modified.

If you cannot complete the task cleanly, report \`done: false\` with a concrete reason. Do not claim partial credit. The launcher will treat \`done: false\` as a task failure and may block downstream tasks that depend on yours.
`
// prompt-sync:end
// prompt-sync:begin prompts/fix-issues.md
const FIX_PROTOCOL = `# Fix Protocol

Address concrete review issues in a single file properly. No hacks, no suppressions, no "good enough" patches that paper over the underlying problem.

## Rules

- **Do NOT run ANY git command.** No \`git add\`, \`git commit\`, \`git checkout\`, \`git branch\`, \`git stash\`, \`git rebase\`, nothing. The launcher owns all git.
- **Stay inside your assigned file.** Other fix agents are working on other files in parallel. If a fix genuinely requires changes outside your file, return that information in your summary instead of editing the other file yourself — the orchestrator will resequence.
- **Fix the root cause.** If a review flagged a missing edge-case handler, add the handler and a test that exercises it. Do not silence the lint, do not catch-and-ignore, do not delete the failing test.
- **Add or update tests for every fix.** A bug fix needs a regression test. A correctness fix needs a test that would have caught the original issue. Run the tests and confirm green before finishing.
- **Preserve behavior the reviewers approved of.** Don't rewrite working code while you're in there.

## Fix discipline

- Read the issue. Read the cited code. Reproduce the problem mentally before typing.
- Make the smallest change that addresses the root cause. Resist the urge to refactor adjacent code.
- After the code change, write or update the test that locks the fix in. The test must fail against the pre-fix code and pass against the fixed code.
- Run the affected test file (and any obvious siblings) and confirm green. If the project has a fast lint or typecheck, run it too.

## When to reject an issue

Not every review finding is real. You may return an issue as unfixed if:

- The cited code does not actually exhibit the described behavior (hallucination). Explain what the code actually does.
- The fix would require editing a file owned by another agent in this round. Describe the cross-file change needed.
- The "issue" is a stylistic preference contradicted by the surrounding codebase conventions. Cite the convention.

Do NOT reject an issue because the fix is annoying, because tests are flaky, or because you disagree with the severity.

## How to verify

- Run the narrowest test command that covers your file (e.g. \`pytest path/to/test_foo.py\`, \`npm test -- foo.test.ts\`).
- For a bug fix, confirm the new test fails on the prior code by reasoning about it, or by reverting your edit by hand and re-running; never with git.
- Scratch files go in a \`mktemp -d\` directory you delete before you report.
- For a correctness fix, walk through the new code path with the inputs from the review finding.

## What you receive

- The file path you own for this fix round.
- \`ISSUES\` — a JSON list of \`{file, detail, severity}\` review findings to address. Treat each one as a must-fix unless it falls under the rejection criteria above.

## Output Schema

Return JSON:

\`\`\`json
{
  "fixed": [
    "Added null-guard in parseHeader and regression test in test_parse.py",
    "Skipped: 'use Map instead of object' — code already uses Map; reviewer misread line 42",
    "Skipped: requires editing src/other.ts which is owned by another agent this round"
  ]
}
\`\`\`

- \`fixed\` — a list of short strings, one per issue. Each string says either what you did or why you didn't (with enough detail for the orchestrator to resequence or drop the finding).
- The list length must match the number of input ISSUES — one entry per finding, in order.
`
// prompt-sync:end
// prompt-sync:begin prompts/review-completeness.md
const REVIEW_COMPLETENESS_PROTOCOL = `# Staff Review — Completeness & Correctness

You are a staff engineer reviewing the changed code in the working tree against the plan's success criteria. Your job is to confirm the implementation actually delivers what the plan promised — every criterion, every test, every edge case.

## Scope

Review **only** the files changed in the working tree. Enumerate the changeset with \`git status --porcelain\` (or use the \`CHANGED_FILES\` list the orchestrator provides) — this **includes newly created (untracked) files** that \`git diff\` alone omits. Inspect modified files with \`git diff\`; **read newly created files directly** (they won't appear in \`git diff\`). Do not review unchanged code or speculate about future tasks.

## What to check

Walk every task's success-criteria checklist against the actual code and tests. For each criterion:

- Is the behavior implemented?
- Is there a test that exercises it (not just asserts it compiles)?
- Does the test cover the happy path, the error path, and the edge cases the plan or the criterion implied?

Then confirm the cross-cutting requirements:

- **Bugfixes have a regression test** that would have failed against the pre-fix code.
- **Features have integration and e2e tests**, not only unit tests. No mocking when a real service was feasible.
- **Error and edge cases** are exercised, not just the happy path.
- **Security-relevant changes** address obvious OWASP-class risks (authn/authz, injection, secrets, deserialization, SSRF, etc.) appropriate to the change.

## Verdict

- \`approved: true\` only when every success criterion is met by code AND a test, and no required test type is missing.
- \`approved: false\` otherwise. Return \`issues\` as a list of \`{file, detail, severity}\` — be specific: name the unmet criterion, the missing test, or the uncovered case. "Looks fine" is not a finding; concrete misses are.

A missing regression test for a bugfix or a missing e2e/integration test for a feature is automatically \`approved: false\`.
`
// prompt-sync:end
// prompt-sync:begin prompts/review-quality.md
const REVIEW_QUALITY_PROTOCOL = `# Staff Review — Code Quality & Architecture

You are a staff engineer reviewing the changed code for quality and architectural fit. You are not hunting for bugs (separate audits handle that) — you are evaluating whether the code is something the team should live with.

## Scope

Review **only** the files changed in the working tree. Enumerate the changeset with \`git status --porcelain\` (or use the \`CHANGED_FILES\` list the orchestrator provides) — this **includes newly created (untracked) files** that \`git diff\` alone omits. Inspect modified files with \`git diff\`; **read newly created files directly** (they won't appear in \`git diff\`). Don't grade code that wasn't touched.

## What to check

- **Structure** — Are responsibilities cleanly separated? Are functions and modules at the right level of abstraction?
- **DRY without overengineering** — Real duplication consolidated; no premature abstractions, no speculative interfaces.
- **YAGNI** — No dead code, no unused parameters, no "we might need this later" branches.
- **Naming** — Identifiers describe intent, not implementation detail. Consistent with existing codebase conventions.
- **Error handling** — Failures are handled at the right layer. No swallowed exceptions, no ignored returns, no panic-on-input from user-facing entry points.
- **Obvious performance** — No O(n²) where O(n) is trivial, no synchronous calls in hot loops, no per-request allocations that could be reused. (Deep perf analysis is a separate audit; flag only the obvious smells.)
- **Consistency with the codebase** — Uses the same patterns, helpers, and idioms as the surrounding code. Doesn't introduce a new style for an already-solved problem.

## Verdict

- \`approved: true\` if the code is clean, consistent, and at the right altitude — even if you'd write it slightly differently.
- \`approved: false\` with specific \`issues\` (\`{file, detail, severity}\`) if there are real quality problems. Each issue should reference a concrete file and explain what to change. Style nits go in \`severity: low\`; structural problems go higher.
`
// prompt-sync:end
// prompt-sync:begin prompts/review-bug-audit.md
const REVIEW_BUG_AUDIT_PROTOCOL = `# Bug Audit (Single-Pass)

Audit the changed code for correctness bugs in a single pass. This is a lightweight check inside the workflow — for full adversarial depth (hunter / skeptic / referee), \`/audit:bugs\` is run separately.

## Scope

Review **only** the files changed in the working tree. Enumerate the changeset with \`git status --porcelain\` (or use the \`CHANGED_FILES\` list the orchestrator provides) — this **includes newly created (untracked) files** that \`git diff\` alone omits. Inspect modified files with \`git diff\`; **read newly created files directly** (they won't appear in \`git diff\`).

## What to look for

- **Logic errors** — wrong operator, off-by-one, inverted condition, miscounted bounds, incorrect default, wrong return type.
- **Race conditions** — shared state without synchronization, check-then-act, time-of-check-to-time-of-use, unsafe iteration during mutation.
- **Edge cases** — empty input, null/undefined, zero, negative, large, unicode, trailing whitespace, duplicate keys, the values that look "obviously fine" but break parsers.
- **Error handling** — uncaught exceptions, swallowed errors, errors that should surface but don't, retries on non-idempotent operations.
- **Resource leaks** — unclosed files, streams, connections, timers, listeners; missing cleanup on the error path.

## Standard

Only report findings with a **concrete trigger** — a specific input, sequence, or state that causes the bug. "Could potentially fail under unusual conditions" is not a finding. "Returns wrong total when input list is empty (line 42)" is a finding.

## Verdict

- \`approved: true\` only when no real bugs were found. If you have to hedge, you don't have a finding.
- \`approved: false\` with \`issues\` as a list of \`{file, detail, severity}\`. \`detail\` must include the trigger and the impact.
`
// prompt-sync:end
// prompt-sync:begin prompts/review-security-scan.md
const REVIEW_SECURITY_SCAN_PROTOCOL = `# Security Scan (Single-Pass)

Audit the changed code for exploitable security vulnerabilities in a single pass. This is a lightweight check inside the workflow — for full adversarial depth (finder / disprover / referee), \`/audit:security\` is run separately.

## Scope

Review **only** the files changed in the working tree. Enumerate the changeset with \`git status --porcelain\` (or use the \`CHANGED_FILES\` list the orchestrator provides) — this **includes newly created (untracked) files** that \`git diff\` alone omits. Inspect modified files with \`git diff\`; **read newly created files directly** (they won't appear in \`git diff\`).

## What to look for

Concentrate on classes of bugs an attacker could actually exploit, not theoretical risks.

- **Injection** — SQL, command, template, LDAP, XPath, header — any place untrusted input flows into an interpreter.
- **Authentication & authorization** — missing checks, broken role boundaries, predictable tokens, session fixation, missing CSRF where it matters.
- **Secrets and credentials** — secrets in code, logs, error messages, or VCS; weak crypto; hardcoded keys.
- **Deserialization & parser abuse** — untrusted YAML/pickle/Java-serialized/etc., XXE, zip-slip, path traversal.
- **SSRF / open redirect** — fetches or redirects whose target is influenced by untrusted input.
- **Resource exhaustion at attacker control** — unbounded loops, regex catastrophic backtracking, billion-laughs, recursive parsing.
- **Insecure defaults** — TLS verification disabled, permissive CORS, world-readable files, debug endpoints exposed.

## Standard

Every finding must include a **traced input → impact path**: what untrusted source the data comes from, how it flows through the changed code, and what an attacker can do with it. "This looks risky" is not a finding. "User-controlled \`name\` from the HTTP body is concatenated into the SQL string at line 87, allowing arbitrary SELECT statements" is a finding.

## Verdict

- \`approved: true\` only when no exploitable vulnerabilities were found in the changed code.
- \`approved: false\` with \`issues\` as a list of \`{file, detail, severity}\`. \`detail\` must describe the input source, the sink, and the impact. Severity should reflect exploitability and blast radius (auth bypass / RCE = high; weak headers in non-sensitive endpoints = low).
`
// prompt-sync:end
// prompt-sync:begin prompts/review-perf-audit.md
const REVIEW_PERF_AUDIT_PROTOCOL = `# Performance Audit (Single-Pass)

Audit the changed code for real performance bottlenecks at realistic production scale, in a single pass. This is a lightweight check inside the workflow — for full adversarial depth (hunter / skeptic / referee), \`/audit:performance\` is run separately.

## Scope

Review **only** the files changed in the working tree. Enumerate the changeset with \`git status --porcelain\` (or use the \`CHANGED_FILES\` list the orchestrator provides) — this **includes newly created (untracked) files** that \`git diff\` alone omits. Inspect modified files with \`git diff\`; **read newly created files directly** (they won't appear in \`git diff\`).

## What to look for

Focus on bottlenecks that bite at realistic scale, not micro-optimizations.

- **Algorithmic complexity** — accidental O(n²) where O(n) was trivial, nested loops over already-loaded collections, repeated linear scans for a lookup that could be a map.
- **N+1 queries / fan-out** — per-item DB queries inside a loop, per-item RPCs, per-item file reads, missed batching.
- **Blocking I/O on hot paths** — synchronous network/disk in request handlers or render paths, no concurrency where it would obviously help.
- **Allocations in hot loops** — unnecessary copies, per-iteration buffers, string concatenation that could be joined, regex compiled per call.
- **Caching opportunities missed** — values recomputed every call that are deterministic and stable; configuration parsed per request.
- **Backpressure & unbounded work** — unbounded queues, parallelism without limit, retries without timeout, listeners that accumulate without cleanup.
- **Missing indices / inefficient query patterns** — DB queries that obviously can't use an index (\`LIKE '%foo'\`, full-table scans, missing pagination).

## Standard

Every finding must describe **the realistic scale at which it bites** and the rough cost. "Inefficient" is not a finding. "\`getUser(id)\` is called once per row inside a loop iterating up to 10k rows; each call hits the DB — 10k round-trips per request at p99 batch size" is a finding.

## Verdict

- \`approved: true\` if no real bottleneck was found at realistic scale.
- \`approved: false\` with \`issues\` as a list of \`{file, detail, severity}\`. \`detail\` must include the workload that triggers the cost. Severity should track the impact under expected production load.
`
// prompt-sync:end

const bullets = (items) => items.map((s) => '- ' + s).join('\n')
const issueLines = (issues) => bullets(issues.map((i) => `[${i.severity || '?'}] ${i.file}: ${i.detail}`))

const withRetry = async (thunk, onFail) => {
  try { return await thunk() } catch { try { return await thunk() } catch { return onFail() } }
}

const IMPL_SCHEMA = { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } } } }
const REVIEW_SCHEMA = {
  type: 'object',
  required: ['approved', 'issues'],
  properties: {
    approved: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'object', required: ['file', 'detail'], properties: { file: { type: 'string' }, detail: { type: 'string' }, severity: { type: 'string' } } } },
  },
}
const FIX_SCHEMA = { type: 'object', required: ['fixed'], properties: { fixed: { type: 'array', items: { type: 'string' } } } }

// ---- dependency-ordered implementation scheduler ----
async function implement() {
  phase('Implement')
  const status = new Map(TASKS.map((t) => [t.id, 'pending']))
  const done = (id) => status.get(id) === 'done'
  const depFailed = (t) => (t.deps || []).some((d) => status.get(d) === 'failed' || status.get(d) === 'blocked')
  const results = []
  let guard = 0
  while ([...status.values()].some((s) => s === 'pending') && guard++ < TASKS.length + 2) {
    // a task whose prerequisite failed/blocked can never run cleanly — block it (don't build on missing work)
    for (const t of TASKS) {
      if (status.get(t.id) === 'pending' && depFailed(t)) status.set(t.id, 'blocked')
    }
    let ready = TASKS.filter((t) => status.get(t.id) === 'pending' && (t.deps || []).every(done))
    if (!ready.length) {
      const stuck = TASKS.filter((t) => status.get(t.id) === 'pending')
      if (!stuck.length) break
      // remaining tasks form a dependency cycle (deps pending, none failed) — dispatch to avoid deadlock
      ready = stuck
      log(`scheduler: ${ready.length} task(s) in a dependency cycle — dispatching to avoid deadlock`)
    }
    // file-ownership: don't let two tasks in the same wave touch the same file
    const wave = []
    const claimed = new Set()
    for (const t of ready) {
      if (wave.length >= MAX_IMPL) break
      const files = (t.files || []).map(normPath)
      if (files.some((f) => claimed.has(f))) continue
      files.forEach((f) => claimed.add(f))
      wave.push(t)
    }
    const waveRes = await parallel(
      wave.map((t) => () =>
        withRetry(
          () =>
            agent(
              `${IMPLEMENT_PROTOCOL}
---
${TEST_LINE}
TASK ${t.id}:
${t.text}

FILES YOU OWN (modify only these): ${(t.files || []).join(', ') || '(see task)'}

PLAN CONTEXT:
${PLAN.slice(0, 4000)}`,
              { label: `impl:${t.id}`, phase: 'Implement', schema: IMPL_SCHEMA, effort: 'medium', ...MODEL }
            ),
          () => ({ done: false, summary: 'implementation failed' })
        )
      )
    )
    // mark done ONLY when the implementer reported success; otherwise the task failed
    wave.forEach((t, i) => {
      const r = waveRes[i] || { done: false, summary: 'no result' }
      status.set(t.id, r.done === true ? 'done' : 'failed')
      results.push({ id: t.id, ...r })
    })
    log(`implemented wave: ${wave.map((t) => `${t.id}:${status.get(t.id)}`).join(', ')}`)
  }
  const failed = [...status].filter(([, s]) => s === 'failed').map(([id]) => id)
  const blocked = [...status].filter(([, s]) => s === 'blocked').map(([id]) => id)
  return { results, failed, blocked }
}

// ---- review + audit (5 parallel) ----
async function reviewRound() {
  const passes = [
    {
      key: 'completeness',
      directive: `${REVIEW_COMPLETENESS_PROTOCOL}
---
Apply the protocol above to the changed files in the working tree (use git diff to see them).

PLAN:
${PLAN}`,
    },
    {
      key: 'quality',
      directive: `${REVIEW_QUALITY_PROTOCOL}
---
Apply the protocol above to the changed files in the working tree (use git diff to see them).`,
    },
    {
      key: 'bug-audit',
      directive: `${REVIEW_BUG_AUDIT_PROTOCOL}
---
Apply the protocol above to the changed files in the working tree (use git diff to see them).`,
    },
    {
      key: 'security-scan',
      directive: `${REVIEW_SECURITY_SCAN_PROTOCOL}
---
Apply the protocol above to the changed files in the working tree (use git diff to see them).`,
    },
    {
      key: 'perf-audit',
      directive: `${REVIEW_PERF_AUDIT_PROTOCOL}
---
Apply the protocol above to the changed files in the working tree (use git diff to see them).`,
    },
  ]
  const res = await parallel(
    passes.map((p) => () =>
      withRetry(
        () => agent(p.directive, { label: `review:${p.key}`, phase: 'Review', schema: REVIEW_SCHEMA, effort: 'high' }),
        // a double-failed review is NOT a clean pass — record it as a coverage gap
        () => ({ approved: false, failed: true, key: p.key, issues: [] })
      )
    )
  )
  const issues = res.filter(Boolean).flatMap((r) => r.issues || [])
  const failedDimensions = res.filter(Boolean).filter((r) => r.failed).map((r) => r.key)
  return { issues, failedDimensions }
}

async function main() {
  let implFailed = []
  let implBlocked = []
  if (TASKS.length) {
    const im = await implement()
    implFailed = im.failed
    implBlocked = im.blocked
  }

  const baseGaps = []
  if (implFailed.length) baseGaps.push(`tasks failed to implement: ${implFailed.join(', ')}`)
  if (implBlocked.length) baseGaps.push(`tasks blocked by failed prerequisites: ${implBlocked.join(', ')}`)

  if (!AUDIT) {
    return baseGaps.length
      ? `GO-TIME-EXEC: NEEDS ATTENTION —\n${bullets(baseGaps)}`
      : `GO-TIME-EXEC: IMPLEMENTED — all ${TASKS.length} task(s) done. Working tree ready for pre-flight review.`
  }

  let lastIssues = []
  for (let round = 0; round <= FIX_CAP; round++) {
    phase('Review')
    const { issues, failedDimensions } = await reviewRound()
    lastIssues = issues
    const gaps = [...baseGaps]
    if (failedDimensions.length) gaps.push(`review dimensions did not run: ${failedDimensions.join(', ')}`)

    // Only certify clean when there are no open issues AND no coverage gaps.
    if (!issues.length && !gaps.length) {
      return `GO-TIME-EXEC: APPROVED — all ${TASKS.length} task(s) implemented and reviewed clean. Working tree ready for pre-flight review.`
    }
    // Gaps can't be fixed by another review round — surface them and stop trying to certify clean.
    if (gaps.length) {
      const issueList = lastIssues.length ? `\n\nOpen issues:\n${issueLines(lastIssues)}` : ''
      return `GO-TIME-EXEC: NEEDS ATTENTION — coverage gaps (do NOT commit as reviewed-clean):\n${bullets(gaps)}${issueList}`
    }
    if (round === FIX_CAP) break
    log(`review round ${round + 1}: ${issues.length} issue(s), dispatching fixes`)
    phase('Fix')
    const byFile = {}
    for (const it of issues) {
      const file = normPath(it.file)
      ;(byFile[file] = byFile[file] || []).push({ ...it, file })
    }
    await parallel(
      Object.entries(byFile).map(([file, its]) => () =>
        withRetry(
          () => agent(
            `${FIX_PROTOCOL}
---
${TEST_LINE}
Address these review issues in ${file}.

FILE: ${file}
ISSUES:
${JSON.stringify(its, null, 2)}`,
            { label: `fix:${file}`, phase: 'Fix', schema: FIX_SCHEMA, effort: 'medium', ...MODEL }
          ),
          () => ({ fixed: [] })
        )
      )
    )
  }
  return `GO-TIME-EXEC: NEEDS ATTENTION — ${lastIssues.length} issue(s) still open after ${FIX_CAP} fix round(s):\n${issueLines(lastIssues)}\n\nWorking tree has the implemented changes; resolve these before the launcher commits.`
}

return await main()
