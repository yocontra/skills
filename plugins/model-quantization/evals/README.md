# model-quantization plugin evals

Behavioral tests for the `model-quantization` plugin, run with
[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). They check behavior,
not file syntax — use `claude plugin validate` for the latter.

## Run

```bash
# From the repo root. One case, one run, no baseline — the cheap inner loop
scripts/run-evals.sh model-quantization --case llamacpp-routing --runs 1 --ablation none

# Routing only
scripts/run-evals.sh model-quantization --tag routing --runs 1 --ablation none

# Everything, with the no-plugin baseline
scripts/run-evals.sh model-quantization
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## Cases

All cases are not yet measured.

| Case | Kind | Asserts |
|------|------|---------|
| `llamacpp-routing` | routing | Shrinking an LLM for Android llama.cpp loads `model-quantization`, runs `convert_hf_to_gguf`, defaults to Q4_K_M, and checks the result against the 6 GB device budget including KV cache or activations. |
| `palettize-is-not-generic` | neighbor | A coremltools palettization request does not load `model-quantization` (it belongs to `coreml-optimization`) and still names `OpPalettizerConfig` / `palettize_weights`. |
| `gptq-mobile-settings` | knowledge | AutoGPTQ is deprecated in favor of `gptqmodel`, and `desc_act=False` for mobile because `True` serializes inference and breaks Marlin/ExLlama kernels. |
| `awq-library-choice` | knowledge | AutoAWQ is deprecated; AWQ is written with GPTQModel (`AWQConfig`) or llm-compressor's `AWQModifier`. |
| `iphone-memory-fit` | knowledge | An 8B INT4 model peaks near 4.8 GB, which is too tight for an iPhone 15 Pro under the keep-it-under-half-of-RAM rule. |

## Sandbox constraints these cases are written around

A run gets a throwaway HOME and an empty working directory with only this plugin loaded.
`Bash`, `Write`, and `Edit` are not granted, so commands come back in the response rather
than running. Each case carries the standard `append_system_prompt` so a missing shell does
not turn into a stalled answer.

## Adding a case

One directory per case, holding `prompt.md` (frontmatter = case config, body = the prompt)
and a `graders/` directory with one `.md` per grader. Keep at least one non-Skill grader on
every case, or a two-arm run scores it on nothing.
