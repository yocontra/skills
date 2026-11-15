# Memory estimation and quality validation

## Formulas

```
Weight memory = parameters × bytes_per_param

  FP32: params × 4 bytes
  FP16: params × 2 bytes
  INT8: params × 1 byte
  INT4: params × 0.5 bytes

KV cache (LLMs) = 2 × layers × kv_heads × head_dim × seq_len × bytes_per_element

Peak inference memory ≈ weight_memory × 1.2  (activations + intermediates + overhead)
```

Activations alone can be 20–50% of peak memory; the 1.2 factor is a floor, not a ceiling,
for long contexts or large images.

## Quick reference

| Model size | FP16 | INT8 | INT4 | Peak (INT4) |
|------------|------|------|------|-------------|
| 125M | 250 MB | 125 MB | 63 MB | ~75 MB |
| 350M | 700 MB | 350 MB | 175 MB | ~210 MB |
| 1B | 2 GB | 1 GB | 500 MB | ~600 MB |
| 3B | 6 GB | 3 GB | 1.5 GB | ~1.8 GB |
| 7B | 14 GB | 7 GB | 3.5 GB | ~4.2 GB |
| 8B | 16 GB | 8 GB | 4 GB | ~4.8 GB |
| 13B | 26 GB | 13 GB | 6.5 GB | ~7.8 GB |

## Device budgets

- iPhone physical RAM: 6 GB (iPhone 15 / 15 Plus), 8 GB (15 Pro, 16 series, 17), 12 GB
  (17 Pro / Pro Max / Air). An app gets less than that before iOS terminates it; the
  `com.apple.developer.kernel.increased-memory-limit` entitlement raises the ceiling on
  supported devices.
- Android: 4 GB (budget), 6 GB (mid-range), 8–16 GB (flagship).

Keep the model under 50% of physical RAM. An 8B INT4 model at 4.8 GB peak is tight even on
8 GB devices.

## Perplexity

Measure perplexity yourself on the same text for FP16 and every candidate
(`llama-perplexity -m model.gguf -f wiki.test.raw` for GGUF); published numbers vary with
model, dataset, context length, and tool version, so compare only runs you made. Expect
Q8_0 and Q6_K to be near-lossless, Q4_K_M and 4-bit AWQ/GPTQ to cost a few percent, and
Q3/Q2 types to degrade visibly.

Perplexity overstates real-world degradation for AWQ/GPTQ: task benchmarks (MMLU,
HumanEval, etc.) show under 2% accuracy drop at 4-bit. Flag anything over 15% perplexity
increase for review.

## Other model types

- Diffusion: CLIP score (higher is better) and FID (lower is better), measured on 500+
  generations with diverse prompts against a reference set. CLIP under 0.25 indicates
  prompt-image misalignment; FID over 50 indicates significant degradation.
- TTS: MOS (1–5, higher is better) and CER (lower is better) against reference audio. MOS
  under 3.5 is generally unacceptable for production.
- ASR: WER on LibriSpeech test-clean. Flag over 1% absolute WER increase from quantization.

General rule: run the quantized model and FP16 on an identical eval set and flag over 5%
task-specific degradation. Coding, math, and STEM degrade more than general QA at INT4.

## Benchmarking on device

- Tokens/sec (LLMs): measure prefill and decode separately; prefill is batched matmul,
  decode is sequential.
- Time to first token: user-perceived latency, often more important than throughput.
- Inference latency: report p50 and p95, not averages; tail latency matters on phones.
- Memory high-water mark: peak RSS during inference, not model size alone.
- Thermal throttling: sustained performance over 5+ minutes; phones throttle aggressively
  (a 40% drop after 30 seconds is common).
- Power: mW during inference, which directly drives battery life.
- Binary size: compressed weights added to the app bundle count against store limits.
