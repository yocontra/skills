# coreml-optimization plugin evals

Behavioral tests for the `coreml-optimization` plugin, run with
[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). They check behavior,
not file syntax — use `claude plugin validate` for the latter.

## Run

```bash
# From the repo root. One case, one run, no baseline — the cheap inner loop
scripts/run-evals.sh coreml-optimization --case coreml-ane-routing --runs 1 --ablation none

# Routing only
scripts/run-evals.sh coreml-optimization --tag routing --runs 1 --ablation none

# Everything, with the no-plugin baseline
scripts/run-evals.sh coreml-optimization
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## Cases

All cases are not yet measured.

| Case | Kind | Asserts |
|------|------|---------|
| `coreml-ane-routing` | routing | A Core ML model stuck on the GPU loads `coreml-optimization`; the plan swaps `RangeDim` for fixed or enumerated shapes and checks per-op placement with `MLComputePlan`. |
| `gguf-is-not-coreml` | neighbor | A GGUF / llama.cpp request does not load `coreml-optimization` (it belongs to `model-quantization`) and still gets `llama-quantize` / Q4_K_M. |
| `joint-compression-rules` | knowledge | Joint compression is INT8 `per_tensor` linear quantization with `joint_compression=True` on a palettized model, and the fast int8×int8 path starts at A17 Pro / M4. |
| `compression-needs-ios18` | knowledge | Per-grouped-channel palettization fails on an iOS 17 model; the fix is re-converting with `ct.target.iOS18` (or per-tensor palettization). |
| `sdxl-split-einsum` | knowledge | Split einsum is not a coremltools flag; the SDXL UNet takes `SPLIT_EINSUM` for the ANE but never `SPLIT_EINSUM_V2` (prohibitive compile time). |

## Sandbox constraints these cases are written around

A run gets a throwaway HOME and an empty working directory with only this plugin loaded.
`Bash`, `Write`, and `Edit` are not granted, so conversions and configs come back in the
response. Each case carries the standard `append_system_prompt` so a missing shell does not
turn into a stalled answer. The knowledge cases aim at rules baseline Claude tends to get
wrong (the per-tensor requirement and chip floor for joint compression, SDXL and split
einsum variants), which is where Δ should come from.

## Adding a case

One directory per case, holding `prompt.md` (frontmatter = case config, body = the prompt)
and a `graders/` directory with one `.md` per grader. Keep at least one non-Skill grader on
every case, or a two-arm run scores it on nothing.
