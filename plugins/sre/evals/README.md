# sre plugin evals

Behavioral tests for the `sre` plugin, run with [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals).
These check behavior, not syntax — use `claude plugin validate` for the latter.

## Run

```bash
cd plugins/sre

# One case, one run, no baseline — the cheap inner loop while editing a skill
claude plugin eval . --case splunk-routing --runs 1 --ablation none

# Routing only (no judge calls on the Skill graders themselves)
claude plugin eval . --tag routing

# Everything, with the no-plugin baseline
claude plugin eval .
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## What these measure

`sre` carries six skills that all live in the same incident and observability space, so
**routing is the main thing under test**. A trace, a log line, an exception, an on-call schedule,
a runbook and a post-incident write-up are six different tools here, and the prompts
name the thing the user wants without naming the tool. Where two skills are genuinely
confusable the case also asserts the wrong one stayed quiet:

| Case | Must fire | Must not fire |
|------|-----------|---------------|
| `pagerduty-routing` | `pagerduty` | `rca` |
| `splunk-routing` | `splunk` | `sentry` |

Each case pairs a `tool_used: Skill` grader with a `regex` or `llm` grader on the outcome. A
two-arm run leaves the Skill graders out of the score — a skill can never fire in the
no-plugin arm — so Δ comes from the outcome graders.

The knowledge cases target facts baseline Claude gets wrong:
- `pagerduty-status-flags`, `pagerduty-rest-get-no-j` — `pd` takes repeated `-s` flags, and
  `pd rest get` has no `-j`.
- `splunk-scoped-and-time-bounded`, `splunk-yesterday-window` — SPL scoped by `index=` with a
  time bound that fits the question.

`negative-percentile-concept` is the guardrail: a textbook question about p99 versus p99.9
should pull in no skill at all.

### Explore first

- `rca-explores-sources` — a PIR pulls the incident Slack channel or prior PIRs, not only the PagerDuty incident the user named.

### Bounded output

- `sentry-list-bounded` — listing unresolved prod issues passes `--max-rows`; without it `sentry-cli issues list` fetches up to 500.

### Cleanup and act-then-report

Each skill that creates something removes it, and each write the task implies runs and is reported, not gated on a yes:

- `splunk-async-job-deleted` — an async REST search deletes its job (`DELETE /services/search/v2/jobs/<sid>`) instead of leaving it to hold disk quota.
- `splunk-hec-test-no-junk` — a HEC smoke test sends one marked event to a test index, not a loop into production.
- `pagerduty-resolves-matching` — bulk resolve pins the exact service, resolves exactly the listed IDs in the same turn, reports them, and never uses `-m`.
- `rca-markdown-in-repo` — the RCA lands as Markdown in the repo; issue drafts go to a temp dir, are filed in the same run, and are linked back.

## Cases and rubrics that were tried and withdrawn

- **"Lead with onboarding and link instead of copying."** Passed in both arms of
  `runbook-routing` and `runbook-oblique`. Baseline writes a good onboarding-first runbook on
  its own: shift-zero access checklist, first-five-minutes section, and "link to the PagerDuty
  schedule, don't paste it". Both rubrics are kept, since they still describe the shape the
  skill prescribes, but the Δ now comes from graders alongside them —
  `alerts-name-where-they-are-configured` (the alert inventory records where each alert is
  configured and how it gets changed, which is the anti-drift anchor) and
  `names-the-real-stack` (the document arrives naming the team's actual tooling instead of
  `[PAGING TOOL]` placeholders).

## Sandbox constraints these cases are written around

A run gets a throwaway HOME and an **empty** working directory, with only this plugin loaded —
no CLIs, no tokens, no network to the services. `Bash` is therefore not granted, and
each case sets an `append_system_prompt` telling the agent it has no shell so it describes its
approach instead of stalling. These cases measure routing and knowledge transfer, not live
execution against Sentry, Splunk or PagerDuty.

## Adding a case

One directory per case, holding `prompt.md` (frontmatter = case config, body = the prompt) and
a `graders/` directory with one `.md` per grader. Keep at least one non-Skill grader on every
case, or a two-arm run scores it on nothing.
