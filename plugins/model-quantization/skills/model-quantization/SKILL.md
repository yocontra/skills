---
name: model-quantization
effort: medium
description: Cross-platform model quantization and format conversion — AWQ, GPTQ, GGUF/llama.cpp quant types, ONNX Runtime, ExecuTorch, LiteRT — plus picking a mobile model, estimating phone memory and KV cache, and validating quantized quality. Core ML/ANE compression → coreml-optimization; Android NPU delegation and backend quantizers → android-acceleration.
---

$ARGUMENTS

# Model quantization and mobile optimization

Making models small and fast enough for phones without destroying quality: pick a method,
quantize, convert to the runtime's format, check memory, measure quality. Core ML specifics
(coremltools palettization and joint compression, ANE placement, split einsum, stateful
models) belong to the `coreml-optimization` skill; this skill picks the overall strategy
and handles every other runtime.

## How to work

Do the work, then report. For a quantization or conversion task:

1. Establish the target runtime (llama.cpp, ExecuTorch, ONNX Runtime Mobile, LiteRT,
   Core ML), target devices and their RAM, and the model. Read these from the project and
   request; where they are open, default to the most common path for the model type and
   list the choice under Assumptions.
2. Estimate memory first (weights + KV cache + activations) against the device budget, so
   the bit width is chosen by arithmetic rather than trial. See
   [memory-and-validation.md](references/memory-and-validation.md).
3. Pick the method from the table below and run it. Commands and configs are in
   [methods.md](references/methods.md).
4. Convert to the runtime format; paths are in [conversion.md](references/conversion.md).
   For a Core ML target, hand off compression and placement to `coreml-optimization`.
5. Compare against FP16 on an identical eval set with the metric for the model type, and
   benchmark on the target device.
6. Report the method and settings, size before and after, quality delta against the
   thresholds below, on-device latency and memory high-water mark, and the assumptions made.

## Choosing a method

| Method | Bits | Calibration | Quant speed | Inference | Quality | Best for |
|--------|------|-------------|-------------|-----------|---------|----------|
| AWQ | 4 | Yes (small set) | Fast | Fast | Strong | Mobile LLMs |
| GPTQ | 4 | Yes (128 samples) | Slow | Fast | Good | GPU servers, legacy |
| GGUF Q4_K_M | 4.89 | Optional imatrix | Fast | Fastest | Excellent | llama.cpp mobile |
| GGUF IQ4_XS | 4.46 | Imatrix recommended | Fast | Fastest | Great | Smallest good 4-bit |
| SmoothQuant | 8 | Yes | Fast | Fastest | Near-lossless | When 8-bit is enough |
| INT8 dynamic | 8 | No | N/A | Fast | 0.04% drop | Easy wins |

- AWQ for 4-bit checkpoints served by Transformers, vLLM, or MLX. ExecuTorch quantizes with
  torchao configs at export instead (see `android-acceleration` for the XNNPACK recipe).
- GGUF for llama.cpp deployments.
- INT8 when quality is paramount and memory allows.
- Core ML targets: coremltools palettization or joint compression usually beats importing
  an AWQ/GPTQ checkpoint; see `coreml-optimization`.

### AWQ over GPTQ

- Less accuracy loss: AWQ keeps over 99% of FP16 task accuracy on most benchmarks.
- Faster to quantize (minutes vs hours).
- Generalizes better: AWQ preserves salient weights by activation magnitude, while GPTQ
  overfits its calibration set.
- GPTQ wins mainly for large-batch GPU serving with Marlin-class kernels.
- AutoGPTQ is unmaintained and AutoAWQ is deprecated; use `gptqmodel` (GPTQModel), which
  runs both GPTQ and AWQ, or `llm-compressor` for vLLM serving.
- GPTQ `desc_act=True` buys ~0.05 ppl but makes inference sequential and breaks
  Marlin/ExLlama kernels; use `False` for mobile.

### GGUF types

Start with Q4_K_M (4.89 BPW, 4.58 GiB for Llama-3.1-8B). If it does not fit, IQ4_XS
(4.46 BPW, quantized with an importance matrix from `llama-imatrix`). If quality matters
more than size, Q5_K_M. Q2_K only when nothing else fits. The full type table is in
[methods.md](references/methods.md).

## Memory budget

```
Weight memory = params × bytes_per_param   (FP32 4, FP16 2, INT8 1, INT4 0.5)
KV cache      = 2 × layers × kv_heads × head_dim × seq_len × bytes_per_element
Peak          ≈ weight_memory × 1.2   (activations, intermediates, overhead)
```

Keep the model under 50% of the device's physical RAM; the OS, the app, and other processes
need the rest, and iOS kills apps well before physical RAM is exhausted. Physical RAM:
6 GB on iPhone 15 / 15 Plus; 8 GB on iPhone 15 Pro, the iPhone 16 line, and iPhone 17;
12 GB on iPhone 17 Pro / Pro Max / Air. Android: budget 4 GB, mid-range 6 GB, flagship
8–16 GB. An 8B INT4 model peaks around 4.8 GB, too much for an 8 GB phone. Do not try 7B+ on phones below 8 GB RAM.

The per-size quick-reference table is in
[memory-and-validation.md](references/memory-and-validation.md).

## Quality thresholds

Run the quantized model and FP16 on the same eval set.

| Model type | Metric | Flag when |
|------------|--------|-----------|
| LLM | Perplexity, plus task benchmarks (MMLU, HumanEval) | >15% perplexity increase, or >5% task degradation |
| Diffusion | CLIP score (higher better) + FID (lower better), 500+ diverse prompts | CLIP <0.25 (misalignment), FID >50 |
| TTS | MOS (1–5) + CER | MOS <3.5 |
| ASR | WER on LibriSpeech test-clean | >1% absolute WER increase |

Perplexity overstates real-world loss for AWQ/GPTQ: task benchmarks show under 2% accuracy
drop at 4-bit. Coding, math, and STEM degrade more than general QA at INT4, so weight those
evals when the product depends on them. Benchmarking method (prefill vs decode,
TTFT, p50/p95, thermals) is in
[memory-and-validation.md](references/memory-and-validation.md).

## Picking a model

Pick by memory budget: under 2 GB, SmolLM2 360M or Qwen 3 0.6B; 2–4 GB, Gemma 3 or Llama 3.2
1B; 4–6 GB, Llama 3.2 3B or Phi-4-mini. Prefer models with grouped-query attention
(Llama 3.x, Gemma, Qwen) for a smaller KV cache. Tables for LLM, diffusion, TTS/ASR, and
vision models, plus attention techniques, are in
[architectures.md](references/architectures.md).

## Diffusion

Step reduction is the largest lever: LCM-LoRA (~100 MB adapter) takes 50 steps to 2–4 on SD
1.5 and SDXL, and SD-Turbo / SDXL-Turbo run without classifier-free guidance, halving
compute. Focus quantization on UNet attention blocks; the text encoder is small and often
not worth quantizing; scheduler math is trivial CPU work. Code and memory techniques (VAE
tiling, sequential offloading, FP16 safety) are in
[architectures.md](references/architectures.md#diffusion-optimization).

## Common pitfalls

1. Quantizing too aggressively: start at Q4_K_M or AWQ 4-bit and go lower only when memory
   demands it. Quality drops are non-linear below 4-bit.
2. Ignoring KV cache: a 1B model may need 500 MB for weights, but a 4096-token KV cache adds
   200 MB+. Budget for it.
3. Testing on desktop, deploying on phone: desktop GPUs hide inefficiencies. Benchmark on
   the target device; the ANE, Hexagon NPU, and mobile GPUs behave differently.
4. Wrong calibration data: AWQ/GPTQ quality depends on calibration data matching the
   deployment domain. Generic C4/WikiText works for general models; domain data is better.
5. Forgetting activation memory: activations can be 20–50% of peak memory.
6. Skipping thermal testing: a phone runs well for 30 seconds, then throttles 40%. Test
   sustained inference over 5+ minutes.
