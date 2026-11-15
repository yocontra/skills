# agent-cost-report plugin evals

Behavioral tests for the `agent-cost-report` plugin, run with
[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals).

## Run

```bash
cd plugins/agent-cost-report
claude plugin eval . --case cost-report-routing --runs 1 --ablation none   # cheap inner loop
claude plugin eval . --tag routing
claude plugin eval .                                                        # with baseline
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## What these measure

Not yet measured against a baseline.

- **Routing**: `cost-report-routing` asks by name for a Claude Code cost report. The
  LLM grader checks that the model runs the bundled script with a date range rather than
  paging through 85 MB transcripts. `expensive-sessions-oblique-routing` names no tool. It
  complains about spend and `sleep 600` loops, and the grader checks that the model measures
  first and names the lever: stop sleep-polling and use `run_in_background`.
- **Any machine**: `custom-config-dir-finds-project` is a Linux host with
  `CLAUDE_CONFIG_DIR` set and no known project path. The model should find the project
  with `--list` instead of assuming `~/.claude/projects`.
- **Negative**: `negative-api-pricing-question` is a plain question about the API usage
  fields. No skill should fire. Its Δ is zero by construction.

The script itself is covered by `skills/agent-cost-report/scripts/test_cost_report.py`
(stdlib `unittest`, synthetic fixtures). Run it with
`python3 skills/agent-cost-report/scripts/test_cost_report.py`.

## Sandbox constraints

A run gets a throwaway HOME and an empty working directory, with no transcripts and no
shell. Each case sets the standard `append_system_prompt`, so the graders judge the
process the response describes, not the numbers.

## Adding a case

One directory per case, holding `prompt.md` (frontmatter is the case config, body is the
prompt) and a `graders/` directory with one `.md` per grader. Keep at least one non-Skill
grader on every case.
