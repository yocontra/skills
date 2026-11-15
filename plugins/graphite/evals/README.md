# graphite plugin evals

Behavioral tests for the `graphite` plugin, run with
[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). They check behavior,
not file syntax — use `claude plugin validate` for the latter.

## Run

```bash
# From the repo root — the cheap inner loop while editing the skill
scripts/run-evals.sh graphite --case graphite-routing --runs 1 --ablation none

# Routing only
scripts/run-evals.sh graphite --tag routing --runs 1 --ablation none

# Everything, with the no-plugin baseline
scripts/run-evals.sh graphite
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## Cases

All cases not yet measured.

| Case | Asserts |
|------|---------|
| `graphite-routing` | Stacking a new PR in a Graphite repo loads `graphite` and uses `gt create` + `gt ss`, not `git checkout -b` or `gh pr create`. |
| `graphite-feedback-mid-stack` | Feedback on a mid-stack PR: `gt checkout`, `gt modify`, restack, `gt ss`, with no `git rebase`; threads resolved via `resolveReviewThread`, never with "done" comments. |
| `graphite-merge-acts` | A green, approved stack is merged with `gt merge` and cleaned up with `gt sync`, without a confirmation gate. |
| `graphite-sync-not-git-pull` | Knowledge: a stale stack is updated with `gt sync` / `gt continue`, not `git pull --rebase` per branch. |
| `graphite-detect-without-init` | Knowledge: a read-only Graphite check tests for `.graphite_repo_config`, never `gt trunk`, which initializes the repo. |
| `negative-plain-git-question` | A plain git merge-vs-rebase question fires no skill and gets a correct answer. |

## Where Δ should come from

Baseline Claude knows `gt` exists but tends to fall back on `git rebase`, `gh pr create`,
and "reply 'done' on the thread". The feedback, sync, and routing cases target those
habits. The merge case targets the removed confirmation gate.

## Adding a case

One directory per case, holding `prompt.md` (frontmatter = case config, body = the prompt)
and a `graders/` directory with one `.md` per grader. Keep at least one non-Skill grader on
every case, or a two-arm run scores it on nothing.
