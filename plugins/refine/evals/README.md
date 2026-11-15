# refine plugin evals

Behavioral tests for the `refine` plugin, run with [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals).
These check behavior, not syntax — use `claude plugin validate` for the latter.

## Run

```bash
cd plugins/refine

claude plugin eval . --case simplify-routing --runs 1 --ablation none
claude plugin eval . --tag routing
claude plugin eval .
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## What these measure

- **Routing** — two cases per skill (`simplify`, `code-cleanup`, `freshen-docs`). The first is phrased as the complaint a user would actually make;
  the second (`*-oblique-routing`) is symptom-first and names no tool, so it tests whether
  the `description` alone is enough to route. Each pairs a non-Skill grader on a property
  only this plugin supplies: the behavior-preservation revert stage and diff-only scope on
  `simplify`, the dozen audit axes and the stated fan-out cost on `code-cleanup`, the
  rejected-candidate report and the sweep past the one reported line on `freshen-docs`.
- **Exclusion** — the three confusable pairs, each asserting the wrong sibling did *not*
  fire: a whole-repo sweep is `code-cleanup` and not `simplify`, this-morning's changes are
  `simplify` and not `code-cleanup`, drifted docs are `freshen-docs` and not `code-cleanup`.
  These are Δ-zero by construction (the no-plugin arm can fire nothing), so judge them on
  pass rate.
- **Knowledge** — the facts baseline Claude gets wrong: a blanket `master` → `main` sweep
  breaks branch string values, URL paths, and every token that merely contains the word
  (`ControlMaster`, `webmaster@`, Mastercard). It carries no Skill grader.
- **Teammate inline** — `freshen-docs-teammate-inline`: a teammate that cannot spawn agents
  plays finder, skeptic and referee itself, rather than refusing to read code as the orchestrator.
- **Loop completion and cost** — `code-cleanup-forever-exit`: a forever-mode cycle with issues
  remaining and no stall keeps cycling, and a fix batch that failed twice is reported, not
  retried again. `code-cleanup-effort-knob`: `auditEffort` / `fixEffort` cut cost before a
  model downgrade.
- **No-spawn fallback** — `simplify-inline-when-no-spawn`: a forked worker that cannot spawn
  agents runs the simplifier and then the behavior review inline, reverting from snapshots.
- **Guardrail** — a plain linter-defaults question must route nowhere and must not turn
  into a cleanup sweep.
- **Cleanup and generality** — `simplify-cleanup-after-run`: a fix run keeps its scratch
  copies in a `mktemp -d` dir outside the repo, removes it at the end, deletes stray files,
  and never stashes, commits, branches, or checks out from `HEAD`.
  `code-cleanup-detects-commands`: the test and lint gate comes from the project's own files
  (docs, task runner, manifest, CI), and a missing command is reported, not guessed.
  `code-cleanup-outside-git-default-scope`: outside git, the sweep takes the current folder as
  its scope, states that assumption, and backs files up, instead of asking for paths.
  `freshen-docs-outside-git`: outside a repo there is no diff to undo with, so the skill reports
  first or backs files up before editing, and says what happens to the backup.

## Sandbox constraints these cases are written around

A run gets a throwaway HOME and an empty working directory, with only this plugin loaded.
These skills fan out to many parallel agents in real use, so `Agent` is deliberately **not**
granted — one case would otherwise become a dozen runs. `Bash`, `Write` and `Edit` are
withheld too, and each case sets the standard `append_system_prompt`, so what is under
test is the process the model describes, not the edits it makes.

## Adding a case

One directory per case holding `prompt.md` and `graders/*.md`. Keep at least one non-Skill
grader on every case, or a two-arm run scores it on nothing.

## Rubrics that were tried and withdrawn

- **"The outcome separates corrections from rejected candidates."** Failed on a correct
  response because the sandbox has no shell, so there is no outcome to report — only a
  process. Reworded to grade the process, which passes.
- **"Partition into zones with a dedicated documentation zone."** Failed on the oblique
  freshen-docs case, where the model narrowed to the one symptom the user reported. Zone
  count is an implementation detail of a broad sweep, not a property of every run; replaced
  by an assertion that the sweep goes past the one line the user named.
