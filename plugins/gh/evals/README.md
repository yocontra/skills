# gh plugin evals

Behavioral tests for the `gh` plugin, run with [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals).
These check behavior, not syntax — use `claude plugin validate` for the latter.

## Run

```bash
cd plugins/gh

# One case, one run, no baseline — the cheap inner loop while editing a skill
claude plugin eval . --case open-pr-routing --runs 1 --ablation none

# Routing only (no judge calls, so these are nearly free)
claude plugin eval . --tag routing

# Everything, with the no-plugin baseline
claude plugin eval .
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## What these measure

Each case pairs a prompt a user would actually type with two kinds of grader:

- **`tool_used: Skill`** — did the right skill fire on natural phrasing? This is the
  single most common plugin defect: the skill is correct but its `description` does not
  trigger. Note that a two-arm run deliberately leaves these *out* of the score, because
  a skill can never fire in the no-plugin arm and counting it would inflate Δ. They show
  in the report as pass/fail indicators.
- **`regex` / `llm`** — did the answer carry the house rules the plugin exists to supply
  (`--body-file` only, resolve threads without replying, never open a draft PR by default)? These are the scored graders, so they are what Δ actually reflects.

Every skill carries two routing cases: one direct, one oblique — symptom-first, naming no
skill and no `/gh:x`. Three more are **exclusion** cases for the confusable pairs
(`push` vs `open-pr`, `monitor-pr` vs `open-pr`, `review` vs `monitor-pr`). Those assert the
wrong sibling did *not* fire, with `min: 0, max: 0`. They are Δ-zero by construction, like the
negative case, so judge them on pass rate rather than on Δ.

`review-inline-when-no-spawn` covers a teammate whose spawn failed: the dimensions run
inline, in sequence, and are still verified before they are shown.

Cases tagged `cleanup` (`monitor-pr-cleanup`, `worktree-cleanup`) check that a skill removes
what it created (worktrees, watchers, merged branches) and leaves alone what it did not: a dirty
worktree, an open PR's branch, the user's own worktrees and branches. Run them with
`--tag cleanup`. `open-pr-fork-enterprise` checks environment detection: a fork, an Enterprise
host, and a non-`main` default branch.
`open-pr-graphite-repo` (not yet measured) checks that a Graphite-initialized repo gets its PR
through `gt` rather than `gh pr create`.

## Traps this suite has already paid for

Beyond the ones in the `plugin-evals` skill:

- **A prompt that leaves a premise open invites a hedge, and the hedge fails the rubric.**
  A rubric that forbids an answer outright fails a fair reading of an ambiguous prompt that
  offers it "just in case". Close the premise in the prompt itself rather than loosening the
  rubric.

- **A `not_contains` regex on a flag name fails the correct answer**, which names the flag in
  order to reject it. Use a judge for "refused to do X".
- **A rubric demanding a statement the model has no reason to make fails a perfect answer.**
  "Say the PR is not a draft" fails a response that simply never mentions drafts. So does
  "say each PR gets its own worktree" when the response delegates that to a workflow.
- **A rubric that penalizes a literal command string catches the wrong occurrence.** A
  `git add -A` guard fired on the `git add -A` inside the pre-commit-hook block, which is not
  the commit staging the rule is about. Scope the clause to the step under test.
- **A prompt that needs facts the bare workspace cannot supply gets refused, not answered.**
  A "write the PR description" case must carry the draft in the prompt, or the model
  reasonably declines to invent a diff and the house rule never gets exercised.
- **Judge 503s and run timeouts look exactly like a regression.** Check `costUsd > 0` and read
  the grader `explanation` before believing a failure.
- **A case that passes in both arms is measuring nothing.** A two-arm run reports Δ per case;
  a scorable case sitting at Δ 0.00 is asserting something baseline Claude already does, and
  it drags the suite mean down as the suite grows. Read the no-plugin arm's response text
  before writing the rubric — it tells you what the plugin still has left to supply.

## Rubrics that were tried and withdrawn

- **"REST cannot resolve a review thread; GraphQL can."** Scored 1.00 in *both* arms of
  `gh-resolve-thread` over three runs. The no-plugin response opened with "isn't exposed by
  GitHub's REST API or the plain `gh pr` subcommands", produced the `reviewThreads` query and
  the `resolveReviewThread` mutation unaided, and posted nothing. The API shape is public and
  well documented, so the plugin adds nothing here. Replaced by `resolves-without-asking`,
  which targets the house rule instead: close the round by resolving the threads itself,
  without asking first.
- **"Apply a `CLAUDE.md` only to the files it governs" as an open premise.** The original
  `claude-md-scoping` prompt asked for "every CLAUDE.md applied to every file" in the
  abstract, and baseline corrected the premise in all three runs — it derived the
  root-plus-ancestors rule on its own. The prompt now names a concrete rule in
  `packages/api/CLAUDE.md` and asks for violations in a sibling package, which is a
  specific instruction to disobey rather than a generality to qualify.

## Sandbox constraints these cases are written around

A run gets a throwaway HOME and an **empty** working directory, with only this plugin
loaded — no `gh` auth, no git repo, no network to private hosts. `Bash` is
therefore not granted, and each case sets an `append_system_prompt` telling the agent it
has no shell so it describes its approach instead of stalling on a missing tool. These
cases measure routing and knowledge transfer, not live `gh` execution.

## Adding a case

One directory per case, holding `prompt.md` (frontmatter = case config, body = the
prompt) and a `graders/` directory with one `.md` per grader. Keep at least one non-Skill
grader on every case, or a two-arm run scores it on nothing.
