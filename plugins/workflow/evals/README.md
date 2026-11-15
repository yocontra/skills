# workflow plugin evals

Behavioral tests for the `workflow` plugin, run with
[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). These check
behavior, not syntax — use `claude plugin validate` for the latter.

## Run

```bash
cd plugins/workflow

# One case, one run, no baseline — the cheap inner loop while editing the skill
claude plugin eval . --case go-time-routing --runs 1 --ablation none

# Routing only
claude plugin eval . --tag routing

# Everything, with the no-plugin baseline
claude plugin eval .
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## What these measure

The plugin has two skills, `go-time` and `bug-bash`, and one command, `/broadcast`. None is measured
yet: `baseline-p0.json` lists every case with a null score until the first `--ablation with-without`
run fills it in.

- **broadcast** — `broadcast-routing`: a general message goes to every peer as a `FYI from user:` note
  that does not take over the recipient's turn; `broadcast-targeted`: a message about one PR goes to
  the session whose recent PRs match, not to every session, and sends without asking to confirm.

- **Routing** — `go-time-routing` names an approved OpenSpec change and expects a merge without asking; `approved-plan-oblique-routing`
  names no tool, only a signed-off plan in `docs/plan/` and a request to get it merged;
  `bug-bash-routing` asks to clear "my issue backlog" with no query, so the skill must build the
  default `gh issue list --assignee @me` search itself.
- **bug-bash** — GitHub Issues triage that posts, labels and closes without an approval step:
  - `bug-bash-cannot-reproduce`: a comment asking the reporter for facts, posted without waiting
    for approval; the issue stays open and no fix starts.
  - `bug-bash-fix-lifecycle`: a root-cause comment and progress label at dispatch, a `Fixes #N` PR,
    the label removed when the unit ends; an already-fixed issue is closed as completed with a comment.
  - `bug-bash-user-error`: covered by the docs → reply and close; missed by the docs → a
    docs PR.
  - `bug-bash-swarm-width`: 20 fixers at once (the subagent limit), chained units in order.
  - `bug-bash-cleanup`: only what the run created is removed, told apart by start-of-run snapshots.
- **go-time knowledge** — house rules that contradict what the model would otherwise do:
  - `go-time-env-detect`: default branch, test command, OpenSpec and CI come from the repo, not
    from assumptions.
  - `go-time-cleanup`: after merge, stop watchers, remove the worktree, delete the squash-merged
    branch safely, remove temp files.
  - `no-git-in-workers`: implementation workers never run git; the orchestrator owns it.
  - `new-asks-are-queued`: a new ask mid-run is queued, not pivoted to.
  - `go-time-user-question-queue`: a question with a sensible default is decided and reported as an
    assumption, not asked; independent tasks never block.
  - `go-time-small-issue-fix`: a small fix runs on an inline task list with `/gh:review` only, and
    the issue goes in the PR title and is closed by the PR body.
  - `go-time-no-plan-stops`: no plan or task list for a large change means stop and ask, or
    `/openspec:propose` first, never invented scope.
  - `go-time-openspec-archive-in-last-pr`: the PR that lands an OpenSpec change's last spec
    changes (the last PR of a stack) archives the change in that PR, not after merge.
  - `go-time-flat-roster`: only the lead spawns agents; a teammate whose spawn failed runs
    `/gh:review` inline rather than retrying or skipping it.
- **Loop completion** — `progress-turn-is-not-done`: a status summary with tasks open and
  implementers running is a progress report, not the end.
- **Negative** — a `git rev-parse --show-toplevel` question must route nowhere.

## Earlier findings that still apply

- Naming the counter-argument in the description ("not even their own branch or worktree")
  is what made the no-git rule stick: the model otherwise reaches for a worktree per agent,
  which the Agent tool itself offers.
- A prompt like "take it from here and get it shipped" with no artifact named makes the model
  ask for a pointer and never load the skill. Name the artifact (`docs/plan/`, a change name).

## Sandbox constraints these cases are written around

A run gets a throwaway HOME and an empty working directory with only this plugin loaded. `Bash`,
`Write`, `Edit` and `Agent` are deliberately not granted — `Agent` especially, since a skill that
fans out would really spawn the agents and turn one case into a dozen runs. Each case sets the
standard `append_system_prompt`, so what is under test is the process the response describes, not
the commands it manages to run.

## Adding a case

One directory per case, holding `prompt.md` (frontmatter = case config, body = the prompt) and a
`graders/` directory with one `.md` per grader. Keep at least one non-Skill grader on every case,
or a two-arm run scores it on nothing.
