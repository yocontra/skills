# skill-improver plugin evals

Behavioral tests for the `skill-improver` plugin, run with
[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). They check behavior,
not file syntax — use `claude plugin validate` for the latter.

## Run

```bash
# From the repo root — the cheap inner loop while editing the skill
scripts/run-evals.sh skill-improver --case skill-improver-routing --runs 1 --ablation none

# Everything, with the no-plugin baseline
scripts/run-evals.sh skill-improver
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## Cases

All cases not yet measured.

| Case | Asserts |
|------|---------|
| `skill-improver-routing` | "Review and fix this skill" on a pasted SKILL.md loads `skill-improver`; the fixed skill drops the version and keep-or-edit approval gates and at least two cost problems (padded description, all-caps reasoning scaffold, re-check line, persona preamble, unbounded `git log`). |
| `skill-improver-description-budget` | Knowledge: a 900-char description is not fine because it is billed every session; cut to routing metadata and move examples to the body. |
| `skill-improver-references-key` | Knowledge: `references:` in frontmatter loads nothing; link the file from the body. |
| `negative-write-eval-case` | Writing a new eval case is not a skill review: `skill-improver` stays quiet and an eval case comes back. |

## Sandbox constraints

No shell, so the bundled `lint-skill.mjs` cannot run here. The routing case pastes the skill
into the prompt so the review is graded on the rewrite the response returns.

## Adding a case

One directory per case, holding `prompt.md` (frontmatter = case config, body = the prompt)
and a `graders/` directory with one `.md` per grader. Keep at least one non-Skill grader on
every case, or a two-arm run scores it on nothing.
