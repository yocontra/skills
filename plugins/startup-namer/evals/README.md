# startup-namer plugin evals

Behavioral tests for the `startup-namer` plugin, run with
[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). They check behavior,
not file syntax — use `claude plugin validate` for the latter.

## Run

```bash
# From the repo root. One run, no baseline: the cheap inner loop
scripts/run-evals.sh startup-namer --runs 1 --ablation none

# Routing only
scripts/run-evals.sh startup-namer --tag routing --runs 1 --ablation none

# Full two-arm run with the no-plugin baseline
scripts/run-evals.sh startup-namer
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## Cases

| Case | Asserts |
|------|---------|
| `naming-routing` | Naming a new company loads `startup-namer`, which drafts about 20 candidates with stated assumptions and batches questions at the end instead of surveying first. Not yet measured. |
| `trademark-class-knowledge` | Knowledge: a live mark in Class 25 (clothing) is not a conflict for a SaaS startup; classes 9/42 matter; the search is preliminary and needs an attorney. Not yet measured. |
| `negative-rename-variable` | Renaming a code variable fires no skill and still gets a good name. Not yet measured. |

## Sandbox constraints these cases are written around

A run gets a throwaway HOME and an empty working directory with only this plugin loaded.
`Bash`, `Write`, `Edit`, `WebFetch`, and `WebSearch` are not granted. Each case
carries the standard `append_system_prompt` so a missing shell does not stall the answer.

No network reaches a run, so RDAP, WHOIS, USPTO, and WebSearch checks cannot return real
results. The routing case grades the draft-first shape of the output (candidates,
assumptions, questions last), and the knowledge case grades the trademark-class rule the
skill applies, neither of which depends on a live lookup.

## Adding a case

One directory per case, holding `prompt.md` (frontmatter = case config, body = the prompt)
and a `graders/` directory with one `.md` per grader. Keep at least one non-Skill grader on
every case, or a two-arm run scores it on nothing.
