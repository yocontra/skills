# Multi-PR sweep: workflow args

Args for `workflows/monitor-pr/monitor-pr.js`, launched from [`monitor-pr`](../SKILL.md#multi-pr-sweep). They are a structured contract — users never type them; translate the user's phrasing into them.

| Arg | Type | Notes |
|---|---|---|
| `prs` | `number[]` | Explicit PR numbers in the current repo. |
| `author` | `string` | GitHub login. `gh pr list --author <login>`. Use `@me` if the user means themselves. |
| `query` | `string` | Raw `gh pr list --search` query. Use when the user describes a filter that's not just an author. |
| `state` | `'open' \| 'closed' \| 'all'` | Default `'open'`. |
| `titlePrefix` | `string` | Case-sensitive title prefix post-filter. Set whenever `query` uses `in:title` — `gh`'s match is case-insensitive and substring-y. |
| `excludePrs` | `number[]` | PR numbers the sweep must never touch, whatever the other selectors match. Use for a PR someone is driving by hand, or one that is deliberately parked. Enforced both in discovery and again on its result. |
| `owner`, `repo` | `string` | Default: derived from cwd. The fix step needs an in-repo worktree. |
| `includeGreen` | `boolean` | Default `false`. Set `true` only when the user explicitly says "all of them", "even green", "force a rebase across the fleet". |
| `rebase` | `boolean` | Default `false`. Set `true` when the user says rebase / sync / "bring up to date". Force-push uses `--force-with-lease`. A conflicted PR is rebased regardless of this flag — the branch cannot be left conflicting. |
| `dryRun` | `boolean` | Set `true` when the user says "show me what you'd do" or the candidate set is likely large. |
| `ignoreBotAuthors` | `string[]` | Authors whose generic stub comments are dropped from feedback, and whose findings the fix agent triages as an AI reviewer's (verify, then act by tier). Default covers common bots. Substantive comments from these authors are still kept. |
| `preCommitCmd` | `string` | Override the lint/pre-commit command. Default: auto-detect `pre-commit` then project lint. |
| `hardConstraintsExtra` | `string` | Extra rules to inject into every fix-agent's hard-constraints block (e.g. project-specific "link issues as #123, never as a full URL"). |
| `fixModel` | `string` | Model for the discovery and per-PR fix agents. Omit to inherit the session model. The fix agents dominate a sweep's cost, and most of their work — docs, comments, test tweaks, resolving threads — does not need the top tier, so `'sonnet'` is a good default for routine sweeps. |
| `fixEffort` | `string` | Reasoning effort for the fix agents (`'low'`…`'max'`). Default `'medium'`. Raise it for a PR whose fix needs design judgment, or put that PR in `escalatePrs`. |
| `discoverEffort` | `string` | Reasoning effort for the discovery agent. Default `'low'`: it fetches and filters, it does not reason about fixes. |
| `fixBudgetSec` | `number` | Advisory time budget per fix agent, in seconds, shown in each fix prompt. Default `900`. The 20-minute no-activity `TaskStop` rule still applies. |
| `elapsedSec` | `number` | Seconds since the task started, when this is a later round. Shown to the fix agents next to the budget. The script cannot read the clock (`Date.now()` throws in workflow scripts), so pass it in. |
| `escalatePrs` | `number[]` | PR numbers that get `escalateModel` instead of `fixModel`. Use for the ones with High-severity or security findings, a design change, or a gnarly conflict. |
| `escalateModel` | `string` | Model for the PRs named in `escalatePrs`, e.g. `'opus'`. |

One of `prs` / `author` / `query` is required.

## Mapping common phrasings to args

| User says... | Args |
|---|---|
| "monitor all open alice PRs" / "fix alice's PRs" | `{ author: 'alice' }` |
| "monitor my PRs" / "tend my PRs" | `{ author: '@me' }` |
| "fix PRs 1234, 1235, 1239" / "babysit #1234 and #1240" | `{ prs: [1234, 1235, 1239] }` |
| "fix every PR with failing checks" / "any PR that needs work" | `{ query: 'is:pr is:open' }` (the skip-green filter handles winnow) |
| "all autofix PRs" / "sweep the autofix PRs" | `{ query: 'in:title "[Autofix]"', titlePrefix: '[Autofix]', rebase: true }` |
| "PRs waiting on me" | `{ query: 'is:pr is:open review-requested:@me' }` |
| "all open alice PRs even if they're green" / "rebase all of alice's PRs" | `{ author: 'alice', includeGreen: true, rebase: true }` |
| "show me what you'd do" / "dry run for alice" | `{ author: 'alice', dryRun: true }` |
| "this is costing too much" / "sweep cheaper" | `{ author: 'alice', fixModel: 'sonnet' }`, escalating only the PRs that need it |
| "sweep my PRs but leave 2247 alone" / "don't touch 2247, I'm driving it" | `{ author: '@me', excludePrs: [2247] }` |

**An exclusion is permanent for the task, not for one run.** Sweeps go in rounds — fix, wait
for CI, re-run against whatever is still red. Every later round needs the same `excludePrs`,
or the PR the user told you to leave alone gets rediscovered and force-pushed on round two.
Carry the list forward, and say which PRs were excluded in the final report so the user can
see they were left alone rather than silently missed.
