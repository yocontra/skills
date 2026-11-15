# agent-ready plugin evals

Behavioral tests for the `agent-ready` plugin (skill: `uplift`), run with
[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). These check
behavior, not syntax — use `claude plugin validate` for the latter.

## Run

```bash
scripts/run-evals.sh agent-ready --case uplift-routing --runs 1 --ablation none  # inner loop
scripts/run-evals.sh agent-ready --tag routing --runs 1 --ablation none
scripts/run-evals.sh agent-ready                                                 # full, two-arm
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## What these measure

- **Routing** — three cases for `uplift`.
  - `uplift-proposes-then-applies` is the main ask ("set this repo up for Claude Code"). It
    passes only if the response audits first, plans concrete changes drawn from the audit
    (CLAUDE.md or AGENTS.md, scoped permissions, hooks, dev-loop commands, `.gitignore`),
    then applies them without an approval step, merging rather than overwriting, and reports
    what changed. A blanket `Bash(*)` or an approval gate fails it.
  - `uplift-routing` covers the non-interactive contract (`--json` implies `--report
    --no-prompt`): an automated caller gets unknown rows, never an
    `AskUserQuestion`.
  - `uplift-oblique-routing` is symptom-first and names no tool, so it tests whether the
    `description` alone routes. It grades the breadth of the audit and, separately, whether
    it reaches the agent-specific dimensions (MCP servers, `CLAUDE.md`,
    `.claude/settings.json`, private sibling repos, CI) that a generic setup review misses.
- **Knowledge** — `knowledge-uplift-report-only`: an audit reports the install or login
  command rather than running it, and checks credentials by presence only. It has no
  Skill grader, because descriptions sit in every session's system prompt, so the fact can
  land without an invocation.
- **Guardrail** — a plain Python tooling question must route nowhere.
- **Cleanup** — `uplift-leaves-nothing-behind` asks for a report-only run and what it
  changed or left behind. A report-only run writes nothing, keeps scratch files in a
  `mktemp -d` dir removed by a `trap`, and ends with no probe or agent still running.
- **Time budget** — `uplift-states-time-budget`: a full audit states an expected
  wall-clock before fanning out the probes.
- **Fan-out cost** — `uplift-fanout-cost`: on a repo with many requirements, the verify
  fan-out is made cheaper with the `verifyModel` workflow argument or narrowed with
  `--quick` / `--service`. Not yet measured.

Cases were renamed from `doctor-*` when the plugin became `agent-ready`. The scores in
`baseline-p0.json` and the history below were measured under the old names and the old
read-only skill. Re-measure before comparing.

## Sandbox constraints these cases are written around

A run gets a throwaway HOME and an empty working directory, with only this plugin loaded:
no project CLIs, no credentials, no network to private hosts. `Bash`, `Write` and `Edit`
are not granted, and each case sets the standard `append_system_prompt` so the agent
describes its approach instead of stalling. `uplift` fans out to verify agents in real use;
`Agent` is deliberately not granted, or one case becomes a dozen runs.

## Why the description is shaped the way it is

A body is not loaded unless the skill fires, so a rule that lives only in the body is
missing exactly when a request routes somewhere else. The description therefore states that
uplift applies its changes (read-only under `--report`) and never installs, logs in, or prints secrets.
`knowledge-uplift-report-only` would catch that falling back out.

## Rubrics that were tried and withdrawn

These were measured on the earlier `doctor` skill; the lessons carry over.

- **A plain "is this repo ready" ask on the routing case.** Measured Δ 0.00: baseline
  Claude produced an equally broad audit unprompted. Re-aimed at the non-interactive
  contract, which baseline has no way to know. The broad-audit rubric moved to the oblique
  case.
- **The broad-audit rubric alone on the oblique case.** Still Δ 0.00 (W 1.00 / O 1.00),
  because "what will bite a new engineer" invites a broad audit from any competent model.
  Kept, with a second grader, `agent-config-footprint`, for dimensions only this plugin
  treats as readiness. Re-measured W 1.00 / O 0.50. Pairing a Δ-zero rubric with a
  discriminating one beats deleting it.
- **Requiring a literal `VERDICT:` line.** Not adopted: under `--json` it is a field, not a
  line, and a rubric a correct response can fail on formatting is a case defect.
- **`match: not_contains` on `AskUserQuestion`.** Rejected: the correct answer names the
  thing in order to say it will not do it. The judge grades the refusal instead.

## Adding a case

One directory per case holding `prompt.md` (frontmatter = case config, body = the prompt)
and `graders/*.md`. Keep at least one non-Skill grader on every case, or a two-arm run
scores it on nothing. Never name a skill, write `/agent-ready:<x>`, or use the word
"skill" inside a routing prompt; that tests the router's ability to read, not the
description.
