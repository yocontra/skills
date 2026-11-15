# ios-debugging plugin evals

Behavioral tests for the `ios-debugging` plugin, run with
[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). They check behavior,
not file syntax; use `claude plugin validate` for that.

## Run

```bash
# From the repo root: one case, one run, no baseline
scripts/run-evals.sh ios-debugging --case deep-link-routing --runs 1 --ablation none

# Routing only
scripts/run-evals.sh ios-debugging --tag routing --runs 1 --ablation none

# Everything, with the no-plugin baseline
scripts/run-evals.sh ios-debugging
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## Cases

| Case | Asserts |
|------|---------|
| `deep-link-routing` | Checking a screen of an Expo app in the simulator loads `ios-debugging`, reaches it with `xcrun simctl openurl`, and reads the name from the accessibility tree before any screenshot. Not yet measured. |
| `negative-python-flaky-test` | A flaky Django test (general debugging, not simulator work) does not fire `ios-debugging`. Not yet measured. |
| `log-stream-bounded` | Knowledge: `simctl spawn booted log stream` is filtered to the app and run in the background or bounded, never as a blocking call. Not yet measured. |
| `config-plugin-needs-rebuild` | Knowledge: a config plugin / native permission change needs a native rebuild, and the agent reports it rather than starting the user's dev server. Not yet measured. |
| `cleanup-overrides` | Cleanup: the session stops its background log stream and clears the location and status-bar overrides before reporting. Not yet measured. |

## Sandbox constraints these cases are written around

A run gets a throwaway HOME and an empty working directory with only this plugin loaded.
No shell is granted, so simulator commands are written out rather than run, and every
`llm` grader carries the no-shell clause. Each case carries the standard
`append_system_prompt` so a missing shell does not turn into a stalled answer.

The negative case loads only this plugin, so it asserts that `ios-debugging` stays out of
general debugging.
