---
name: plugin-evals
description: Write and run `claude plugin eval` suites for the plugins in this repo. Use when adding or changing a plugin or skill, when a pre-commit `check-evals` failure needs fixing, when a routing regression needs diagnosing, or when the user says "evals", "eval suite", "does my skill fire", or "plugin eval".
effort: medium
---

# Plugin evals

Every plugin in this repo carries a behavioral test suite under
`plugins/<plugin>/evals/`, run with
[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). This is a
merge gate — see "The rule" below.

Evals test *behavior*: does the right skill fire on phrasing a user would
actually type, and does the answer carry the knowledge the plugin exists to
supply. For file syntax and manifest schema, use `claude plugin validate`.

## Run them

```bash
scripts/run-evals.sh gh --case open-pr-routing --runs 1 --ablation none  # inner loop, one run
scripts/run-evals.sh gh --tag routing --runs 1 --ablation none           # routing only
scripts/run-evals.sh gh                                                  # full, two-arm
scripts/run-evals.sh --all --runs 1 --ablation none                      # every plugin
```

Budget at roughly **$0.27 per agent run**, measured over a 60-run two-arm pass on `gh`.
That is $0.177 for the run itself plus about $0.095 of judge calls — and the judge cost is
billed *separately* from the `costUsd` field in the JSON, so reading `costUsd` alone
understates the bill by more than a third. A case with only `regex` and `tool_used`
graders costs the run price and nothing more.

Always dial in with `--runs 1 --ablation none` first. The default is 3 runs in
two arms, so a 10-case suite is 60 agent runs — real money and close to an hour
of wall clock. Add `-j 4` to parallelize and `--max-cost-usd` as a ceiling.

Use `scripts/run-evals.sh`, not `claude plugin eval` directly, when you are an
agent. The eval children get a throwaway HOME and cannot read a stored login, so
export `ANTHROPIC_API_KEY` (or `ANTHROPIC_AUTH_TOKEN`, plus `ANTHROPIC_BASE_URL`
if you call an endpoint other than the public API) first, or every run fails with "Not logged in".

The runner also probes the model API once before spending anything. An API
outage makes every run exit at turn 1 having spent $0, which in the report looks
identical to the plugin regressing on every single case.

Results land in `plugins/<plugin>/evals/results/<timestamp>/report.html`
(gitignored). Open the report to see each grader's verdict per run, including
the judge's votes and the excerpt it judged.

## The rule

`scripts/check-evals.mjs` runs in pre-commit and enforces three things:

1. **Structure** — every case parses, with known frontmatter keys, a non-empty
   prompt, and compilable regexes.
2. **Scorable** — every case has at least one grader that is not
   `tool_used: Skill`.
3. **Coverage** — every plugin has a suite, and every skill in it is named by at
   least one `tool_used: Skill` grader.

So a PR that adds or changes a skill ships evals for it, or it does not merge.

`scripts/evals-exempt.txt` lists the plugins the coverage rule skips, in two
groups. **Upstream-owned** (currently empty) is permanent for any plugin whose
skills are copied in from an upstream package, so an eval-driven skill fix would be
destroyed by the next sync and the eval would be testing code this repo does not
own — fix the upstream project instead. **Pending** is a shrinking baseline for
plugins that predate the rule. The check fails if a listed plugin turns out to
have a suite, which both keeps the pending list honest and stops anyone adding
evals to an upstream-owned plugin. **Never add a new plugin to the pending group.**

## Write a case

One directory per case under `plugins/<plugin>/evals/<case-name>/`:

```
evals/open-pr-routing/
├── prompt.md                      # frontmatter = case config, body = the prompt
└── graders/
    ├── skill-fired.md
    └── preflight-reads-diff.md
```

`prompt.md`:

```markdown
---
description: What this case pins down, for humans.
tags: [routing, open-pr]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

My branch is pushed and the work is finished. Open a pull request for it against main.
```

Copy that `append_system_prompt` verbatim into every task-shaped case. Both arms get it,
so it does not bias Δ, and without it the sandbox eats the result — see the traps below.
`max_turns: 30` and `timeout_seconds: 600` are the working defaults; the built-in 10 turns
and 300 seconds truncate real runs, and a truncated run has no final message, so every
`last_message` grader fails at once.

Cases cannot set effort: there is no `effort` field, and `execution.env` accepts only
`EVAL_*` keys. A run measures the skill's own `effort:` frontmatter, so tune that.

Grader files are frontmatter plus, for `llm`, a body holding the rubric:

```markdown
---
type: tool_used
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?open-pr"'
---
```

```markdown
---
type: llm
---
Judge only the response text.

This environment has no shell and its working directory is empty scaffolding, so no
response can run commands, read the real project, or report real results here. Do not
fail a response for not executing, for declining to invent results, or for offering to
finish against the real project; ignore any preamble about missing tools or files, which
is an artifact of the sandbox, not the behavior under test. Grade only the process the
response describes.

PASS if it reads the actual diff before writing the PR description.

FAIL if it goes straight to `gh pr create` with no inspection step.
```

That sandbox paragraph is mandatory on every `llm` grader, ahead of the criteria: placed
after them, the judge has already failed a correct answer for its "I can't run this here"
preamble. `node scripts/normalize-evals.mjs` writes it for you.

Grader types: `regex` (`pattern`, `flags`, `match`, `target`), `tool_used` (`tool`,
`input_match`, `min`, `max`), `tool_order` (`before`, `after`), `file_exists` (`path`,
`exists`), `llm` (body is the criteria), `baseline` (`baseline_file`). The first four are
computed from the transcript and cost nothing; `llm` and `baseline` spend three judge
calls each, per run.

## Traps, every one of which has already cost a paid pass here

**A Skill-only case is scored on nothing.** In a two-arm run the harness excludes every
`tool_used: Skill` grader from the score, because such a grader can never pass in the
no-plugin arm and counting it would inflate Δ. They show in the report as indicators.
Always pair one with a `regex` or `llm` grader that measures the outcome.

**Never grade a regex against `target: trace`.** The trace includes tool results, and a
Skill call's result is the loaded `SKILL.md`. So `pattern: github\.example\.com` over
the trace passes the moment the skill loads, no matter what the model said. Grade
`last_message` (the default). `check-evals.mjs` rejects this combination.

**Every `llm` rubric needs the no-shell clause.** Without it the judge reads "I can't run
commands here, but here is what I'd do" as handing the work back to the user, and votes
FAIL unanimously on a response that is correct.

**Keep rubrics binary, and never demand a statement the model has no reason to make.** A
rubric requiring the response to say the PR "is not a draft" fails a perfect answer that
simply never mentions drafts. Assert one behavior per grader; mark anything else
explicitly optional, or split it into its own case.

**Don't put a `tool_used: Skill` grader on a knowledge case.** Skill *descriptions* sit in
the system prompt of every session, so a fact stated in a description is available without
invoking anything. Asserting invocation then fails on correct behavior. Assert routing on
task-shaped cases, knowledge on knowledge cases.

**Avoid `match: not_contains` on a flag or command name.** A `--draft` guard fails because
the correct answer names the flag in order to reject it. Use a judge for "refused to do X".

**The workspace is bare and leaky.** Each run gets a throwaway HOME and an empty working
directory whose parent can hold real dotfiles such as `.aws/` and `.gitconfig`. Without the standard
`append_system_prompt` above, a model asked to commit and push spends its whole answer
warning about AWS credentials it found in the parent directory and never loads the skill.

**Do not grant `Agent`.** A skill that fans out to subagents will really spawn them,
turning one case into a dozen runs. `Bash`, `Write`, `Edit`, `WebFetch` and `WebSearch`
are already withheld unless granted with `--allow-tools`.

**Malformed `prompt.md` frontmatter skips the case almost silently** — one load error
prints far above the summary table. A `description:` value containing `: ` or starting
with `"` is invalid unquoted YAML. The same bug in a `SKILL.md` description breaks the
skill itself. `check-evals.mjs` catches the case files; run it before spending anything.

## Choosing what to assert

Aim each case at something the plugin supplies that baseline Claude gets wrong — that is
where Δ comes from. Good targets are org- or tool-specific facts the model would not know (a custom
hostname, "CI is Jenkins, not GitHub Actions"), house rules ("never force-push"), and refusals. Weak
targets are anything a competent model would say anyway; those score 1.00 in both arms and
tell you nothing.

Skills here act, then report (see "Autonomy" in CLAUDE.md), so grade that. A rubric for
an interview-shaped skill asserts that the response drafts the full artifact from what it
can know, marks its assumptions or `TODO:`s, and batches follow-up questions at the end.
Never assert "asks before drafting" or "confirms before acting"; those reward the gates
this repo removed. The two exceptions are a request ambiguous enough to change the work,
and an irreversible action that destroys data the task did not ask to destroy.

Include at least one negative case per plugin: phrasing that should *not* trigger any of
its skills, with `tool_used: Skill, min: 0, max: 0`. Over-eager skill descriptions are as
much a defect as inert ones.

### Cleanup cases

A skill that creates anything temporary (temp dirs, scratch repos, repro scripts, debug
prints, background processes, subagents) needs one case tagged `cleanup` that asserts it
removes what it made and only that. Two shapes:

- **Described cleanup** (the default, no shell): an `llm` grader passes only if the
  response includes an explicit removal step before it reports done, for example
  "remove the `DEBUG-SD` lines and check `git diff` shows only the fix and the test".
  Fail it when removal is optional or missing. Pair it with a cheap `regex` grader.
- **Real cleanup**: grant the tools the skill needs with `--allow-tools`, have the prompt
  name the scratch path, and add a `file_exists` grader with `exists: false` on that path.
  This costs real tool calls, so keep it to one case per plugin.

Do not grade "cleaned up" with `match: not_contains` on the file or marker name: the
correct answer names it in order to remove it.

## Exit checklist

- [ ] Every new or changed skill is named by a `tool_used: Skill` grader on a task-shaped
      case, and every case has a scored grader.
- [ ] Skills that create temporary state have a `cleanup` case.
- [ ] `node scripts/check-evals.mjs` and `node scripts/check-cost.mjs` pass.
- [ ] The plugin's `evals/README.md` lists the new cases, marked "not yet measured" until
      a run exists.
- [ ] No eval run is still going: a backgrounded `run-evals.sh` has exited or been
      stopped by its PID. `evals/results/` is gitignored; leave it, but do not commit
      reports or delete results you did not create.

## Reading a result

`Δ` near zero with the Skill grader failing means the skill is not being chosen on natural
phrasing. That is a `description` problem in `SKILL.md`, not a grader problem — fix the
description and re-run the same suite.

`Δ` near zero with everything passing in both arms means the case asserts something the
model already knew. Re-aim it at plugin-specific knowledge.

Every run's `aggregate-result.json` carries an `evidence` field per grader holding the
exact text that was judged. That is the fastest way to tell a real skill defect from a bad
rubric — read the evidence before changing either.

### Three ways the measurement lies

Each of these produced a false regression during the repo-wide hillclimb, and each cost a
round of investigation before anyone checked the run itself rather than the skill.

**A truncated run is not a measurement.** Hitting `--max-cost-usd` stops the harness paying
for judges: it records `skipped: cost ceiling` in place of a verdict, and those cases score
low exactly like a regression. Check `partial` and `partialReason` in the JSON before
comparing anything. `run-evals.sh` exits non-zero on a partial run, so trust that over
the score table.

**A single run is noisy enough to invent a regression.** Three `sre` cases read 0.50/0.75/0.75
at `--runs 1` and 1.00/1.00/1.00 at `--runs 3`, with no change in between. Confirm anything
you intend to report at three runs.

**A `tool_used: Skill` grader is an unscored indicator in a two-arm run.** The case still
shows 1.00 while the routing assertion under it fails, because a skill can never fire in the
no-plugin arm. Read the indicator column, not the score, when the question is routing.

### Comparing two suites

A mean over a changed case set is not comparable to the old mean. Adding harder cases lowers
the average while nothing has got worse — `gh` held at 0.600 on its original ten cases while
its headline Δ fell, purely because eleven new cases averaged 0.504. When you claim an
improvement or a regression, compute it over the cases present in both runs and say how many
that was.

`Δ` is also bounded by `1.0 − baseline_score`, so the ceiling differs per plugin. Wrappers
around internal or niche tooling reach +0.8 easily; prose and code-review skills cannot, because
a frontier model is already good at them. `exhaustive` measured +0.17 and that is its honest
ceiling — the model volunteers never-sample, count-first and reconcile without any skill
loaded. Report the ceiling rather than chasing a number.
