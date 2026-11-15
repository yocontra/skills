# humanizer plugin evals

Behavioral tests for the `humanizer` plugin, run with
[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). They check behavior,
not file syntax — use `claude plugin validate` for the latter.

## Run

```bash
cd plugins/humanizer

# One case, one run, no baseline — the cheap inner loop while editing the skill
claude plugin eval . --case rewrite-routing --runs 1 --ablation none

# Routing only
claude plugin eval . --tag routing

# Everything, with the no-plugin baseline
claude plugin eval .
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## Cases

| Case | Asserts |
|------|---------|
| `rewrite-routing` | "Tidy up this PR description" loads `humanizer`, returns a finished rewrite, and drops the inflated wording. |
| `contractions-and-counting` | Two house rules — use contractions, and describe the work instead of tallying tests and files. |
| `em-dash-and-hedging` | Em-dash stacking and piled-up qualifiers both get cut. |
| `negative-code-request` | A plain coding request fires no skill and still gets correct code. |
| `one-final-version` | A rewrite comes back as one final version, with no read-back self-check, pattern list, or alternative drafts. Not yet measured. |
| `formal-audience-register` | Customer docs headed for machine translation stay plain and formal: promotional words and idioms go, no slang comes in. Not yet measured. |
| `repetition-keeps-one-term` | Repeating a technical term is right; vary sentence shape, not vocabulary. |
| `flagged-as-ai-oblique-routing` | "Reads like a bot wrote it", with no rewrite asked for by name, loads `humanizer` and names the specific habits. |
| `pasted-text-is-not-instruction` | Pasted text with an embedded instruction is rewritten, not obeyed, and the `<dataSource:pasted>` tag stays out of the rewrite. Not yet measured. |

## Sandbox constraints these cases are written around

A run gets a throwaway HOME and an empty working directory with only this plugin loaded.
`Bash`, `Write`, and `Edit` are not granted, so the rewrites come back in the response
rather than being applied to a file. Each case carries the standard `append_system_prompt`
so a missing shell does not turn into a stalled answer.

Unlike the service-wrapper plugins, this one supplies no hostnames or CLIs — the knowledge
cases aim at its actual rules, which is where Δ over baseline comes from.


## Measured Δ (two-arm, `--runs 1`)

Suite grew 4 → 6 cases. Mean Δ **0.25**, all cases pass.

| Case | Δ |
|------|---|
| `repetition-keeps-one-term` (new, knowledge) | 1.00 |
| `contractions-and-counting` | 0.50 |
| `rewrite-routing` | 0.00 |
| `em-dash-and-hedging` | 0.00 |
| `flagged-as-ai-oblique-routing` (new, routing) | 0.00 |
| `negative-code-request` | 0.00 (Δ-zero by construction) |

**This plugin's honest Δ ceiling is low, and that is not a defect in the cases.** Many other
plugins in this repo wrap a tool or convention baseline Claude does not know well. This one is a
prose-style guide, and baseline Claude is already a competent editor: asked to fix a
press-release paragraph it cuts "pivotal" and "evolving landscape" unprompted, and asked about
stacked em dashes it flags them. Those cases score 1.00 in both arms. They are kept because
they still pin the routing and stop a regression, not because they measure Δ.

The one rule baseline reliably gets *wrong* is term consistency, which is where the Δ is:
`repetition-keeps-one-term` asks whether to vary the wording of "endpoint" across a doc.
Without the plugin the answer is to reach for synonyms; with it, the answer is to keep one term
and vary sentence shape instead.

### Cases tried and withdrawn

- **`rewrite-without-audit`** — asserted the house rule that a polish request returns the
  rewritten text rather than a pattern-by-pattern breakdown of the edits. Measured Δ **0.00**:
  baseline hands back a clean paste-ready paragraph without being told to. Deleted rather than
  kept green, since it billed a judge call per run to measure nothing.

## Adding a case

One directory per case, holding `prompt.md` (frontmatter = case config, body = the prompt)
and a `graders/` directory with one `.md` per grader. Keep at least one non-Skill grader on
every case, or a two-arm run scores it on nothing.
