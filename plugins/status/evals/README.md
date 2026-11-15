# status plugin evals

Behavioral tests for the `status` plugin, run with
[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). These check
behavior, not syntax — use `claude plugin validate` for the latter.

## Run

```bash
cd plugins/status

# One case, one run, no baseline — the cheap inner loop while editing the skill
claude plugin eval . --case standup-routing --runs 1 --ablation none

# Routing only
claude plugin eval . --tag routing

# Everything, with the no-plugin baseline
claude plugin eval .
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## What these measure

Last measured two-arm, one run per arm, before the 1.5 rewrite: **9/9 cases pass, mean Δ 0.72**.
The cases added since have not been run yet.

- **Routing** — two cases per skill. `standup-routing` and `weekly-routing` are the requests a user
  would type; `standup-oblique-routing` ("write the thing I post every morning") and
  `weekly-oblique-routing` ("leadership wants a page on what the group delivered") name no tool
  at all, so they test whether audience and window alone are enough to pick the right sibling.
- **Exclusion** — `exclusion-weekly-not-standup` asserts that a leadership roll-up covering the
  whole team for the week fires `weekly` and that `standup` does **not**. Δ-zero by construction;
  judged on pass rate.
- **Knowledge** — three facts, all at Δ 1.00 except where noted:
  - **Reviews are deliberately not tracked** in the standup. The volume, much of it bot PRs, made a
    review count meaningless, so the right answer declines to add one rather than querying it.
  - **The weekly window is the PR merge date**, not `git log --since`. Committer date is rewritten
    by a rebase, so it tracks neither when work was authored nor when it shipped.
  - **Weekly output carries no links, PR numbers, or commit hashes** — Markdown limited to bold
    initials headers and bullets (`weekly-no-links-or-pr-numbers`). Replaced the earlier plain-text
    rule; not yet re-measured.
- **Negative** — a commit-message-style question must route nowhere. Δ-zero by construction.

### Explore first

- `standup-explores-sources` — the user names only git; the standup still gathers PRs, issues, or the calendar.
- `standup-two-gather-agents` — the prose path spawns two gather agents; identity and repo detection stay with the main agent.
- `standup-cross-repo` — PRs come from `gh search prs --author` across every repo the user touched, not only the cloned one.

### Cleanup

- `standup-cleans-up` — intermediate files go to a `mktemp -d` run directory outside the repo, which
  is removed at the end, and every agent the run started is finished or stopped. A `file_exists`
  grader checks no `standup.md` lands in the working directory.

## Rubrics that were tried and withdrawn

- **"It declines to add the PR links and bold headings the user asked for."** The with-plugin
  response stated the plain-text rule correctly and then *overrode it*, on the ground that the
  user had given an explicit format instruction. That is defensible, and nothing in the skill says a
  user may not override the default, so the rubric was demanding a refusal the plugin does not
  prescribe. Re-aimed at the produced status text itself: given a manager who pastes these into a doc,
  the draft must carry no markdown, no URLs, no PR numbers and no commit hashes.
- **"It refuses the `git log --since` window the user proposed."** Same shape — the response named
  the merge-date rule and the rebase reason, then followed the user's explicit instruction anyway,
  and the judge read that as a FAIL. The prompt now asks which window it *will* use and why, rather
  than instructing it to use the wrong one. Δ went 0.00 → 1.00 with no change to the assertion.
- **A bundled standup rubric** requiring the day window, the own-data sourcing and the team
  audience in one grader. The audience and window belong to the exclusion case; the discriminator
  that actually separates the arms is whether the update is sourced from the user's own commits,
  PRs and calendar rather than from asking the user. Narrowed to that.

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
