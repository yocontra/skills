# android-acceleration plugin evals

Behavioral tests for the `android-acceleration` plugin, run with
[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). They check behavior,
not file syntax; use `claude plugin validate` for that.

## Run

```bash
# From the repo root: one case, one run, no baseline
scripts/run-evals.sh android-acceleration --case qnn-export-routing --runs 1 --ablation none

# Routing only
scripts/run-evals.sh android-acceleration --tag routing --runs 1 --ablation none

# Everything, with the no-plugin baseline
scripts/run-evals.sh android-acceleration
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## Cases

| Case | Asserts |
|------|---------|
| `qnn-export-routing` | "Get our PyTorch classifier onto the Hexagon NPU on S24s" loads `android-acceleration`, quantizes with the QNN INT8 flow, targets `SM8650` at compile time, and ships an XNNPACK fallback. Not yet measured. |
| `negative-room-entity` | A plain Room entity/DAO request fires no skill and still gets correct code. Not yet measured. |
| `mediatek-needs-linux` | Knowledge: MediaTek NeuroPilot backend compilation needs a Linux host, not macOS. Not yet measured. |
| `qnn-chipset-mismatch` | Knowledge: a QNN `.pte` compiled for `SM8650` does not run on `SM8550`; compile per SoC or fall back to XNNPACK. Not yet measured. |

## Sandbox constraints these cases are written around

A run gets a throwaway HOME and an empty working directory with only this plugin loaded.
`Bash`, `Write` and `Edit` are not granted, so export scripts come back in the response.
Each case carries the standard `append_system_prompt` so a missing shell does not turn
into a stalled answer.

The knowledge cases aim at backend-specific build constraints a general model tends to
miss (host OS for MediaTek, chipset binding for QNN), which is where Δ over baseline
should come from.
