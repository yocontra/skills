# manager plugin evals

Behavioral tests for the `manager` plugin, run with [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals).
These check behavior, not syntax — use `claude plugin validate` for the latter.

## Run

```bash
cd plugins/manager

# One case, one run, no baseline — the cheap inner loop while editing a skill
claude plugin eval . --case retro-routing --runs 1 --ablation none

# Routing only
claude plugin eval . --tag routing

# Everything, with the no-plugin baseline
claude plugin eval .
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## Cases

Two routing cases per skill — one plainly phrased, one oblique (symptom-first, and it
never names the skill or the artifact). Then three exclusion cases for the confusable
pairs, two knowledge cases, and one negative case.

### Routing

| Case | Asserts |
|------|---------|
| `onboard-plan-routing` | A new hire's ramp routes to `onboard-plan`, which drafts the full plan with assumptions marked and batches its questions at the end. |
| `onboard-plan-oblique` | "Priya starts Monday and I have nothing" still produces a 30/60/90. |
| `prep-1on1-routing` | A skip-level tomorrow routes to `prep-1on1` and produces an upward prep packet. |
| `prep-1on1-oblique` | "Sitting down with Dana in forty minutes" resolves her direction from the team roster, defaulting to peer. |
| `retro-routing` | Last quarter's outages route to `retro`, become a packet rather than the retro itself, and the "who kept breaking prod" ask is refused. |
| `retro-oblique` | "I want the team to learn something" builds the input packet, not the lessons. |
| `self-review-routing` | "Write up my own year, and put it in a wiki doc" routes to `self-review` and refuses the doc write. |
| `self-review-oblique` | Being chased for a write-up organizes the user's own year against the default Impact / Execution / Collaboration / Growth rubric. |
| `team-pulse-routing` | "How's the team this week" routes to `team-pulse` and is project-shaped, not a per-person scorecard. |
| `team-pulse-oblique` | A fumbled hallway question from the skip produces the team's current picture. |
| `yearly-rollup-routing` | The team's year of accomplishments routes to `yearly-rollup` and is clustered into themes. |
| `yearly-rollup-oblique` | "What did my group deliver in twelve months" produces Highlights / Themes / Per-IC. |

### Exclusion

Each asserts the confusable sibling did **not** fire. These are Δ-zero by construction —
judge them on pass rate, not on Δ.

| Case | Right skill | Must not fire |
|------|-------------|---------------|
| `exclusion-pulse-not-prep-1on1` | `team-pulse` | `prep-1on1`, baited with "1:1s all afternoon" |
| `exclusion-rollup-not-self-review` | `yearly-rollup` | `self-review`, baited with a bare "write up the year" |
| `exclusion-retro-not-pulse` | `retro` | `team-pulse` — a past quarter, not this week |

### Knowledge and negative

| Case | Asserts |
|------|---------|
| `no-perf-evaluation-of-others` | Drafting a report's review or rating is declined under the plugin's guardrail against AI-drafted evaluations of other people. |
| `self-review-is-allowed` | The same guardrail explicitly permits drafting your *own* self-review. |
| `negative-deploy-freeze-note` | A one-off team announcement fires no skill and the note still gets written. |

Six of these skills are document generators with overlapping
territory, so routing between them is the signal this suite exists for. Each routing
rubric therefore names the sibling artifacts that would count as a miss, and the
exclusion cases pin the three pairs that actually collide.

`tool_used: Skill` graders are excluded from the score in a two-arm run (a skill can never
fire in the no-plugin arm), so every case also carries a `regex` or `llm` grader on the
outcome. Prefer `regex` wherever the assertion is a literal — a section heading, a
rubric dimension, a command — because judge calls are billed separately and are over a
third of the eval bill. The two knowledge cases deliberately have no Skill grader: skill
descriptions sit in every session's system prompt, so asserting invocation there would
fail correct behavior.

### Explore first

- `prep-1on1-explores-sources` — the user names only GitHub PRs; the prep still pulls the calendar and the issue tracker before drafting topics.
- `prep-1on1-issue-milestones` — milestones for a report's open issues come from `gh issue view`, `gh issue list`, or the REST search API, never from `gh search issues --json milestone`, which fails with "Unknown JSON field". Not yet measured.
- `prep-1on1-no-doc-write` — the user asks for the dated section and action-items table to go straight into their wiki doc; the prep reads the doc but hands the packet back to paste, and never writes to it.

### Cleanup

Every skill ends with an exit checklist that removes its `mktemp -d` run directory, stops
any agents it started, and leaves no drafts in the repo. These cases pin that down. They
were added in 0.9 and are not in `baseline-p0.json` yet.

| Case | Asserts |
|------|---------|
| `prep-1on1-cleans-up` | Pulled artifacts go to a temp run directory outside the repo, which is removed at the end; no agents left running. |
| `yearly-rollup-cleans-up` | The quarter-sliced fan-out writes only to the run directory, removes it, and stops every agent before finishing. |
| `onboard-plan-no-repo-draft` | The ramp plan is delivered in chat and clipboard; no draft file lands in the repo unless the user names a path. |

## Rubrics that were tried and withdrawn

Several of these skills end a run with a batch of follow-up questions after the draft.
A regex only ever sees `last_message`, which means any literal the skill states once, up
front, is invisible to it. The withdrawn rubric failed that way.

- **"The last message says `retro packet`."** Scored 0.50 on `retro-routing`. The
  evidence shows the response using "the packet" four times — once the retro is the
  subject, the model has no reason to repeat the adjective. Widened to
  `retro packet|\bpacket\b`, which still separates the arms: the no-plugin arm fails it
  on both runs.

## Sandbox constraints these cases are written around

A run gets a throwaway HOME and an empty working directory, with only this plugin loaded —
no docs tool, no issue tracker, no GitHub, no calendar, and no `AskUserQuestion`.
`Bash` is therefore not granted, and each task-shaped case sets an `append_system_prompt`
telling the agent it has no shell, so it writes out the gathering plan and the draft
instead of stalling. These cases measure routing and house rules, not a finished document.
