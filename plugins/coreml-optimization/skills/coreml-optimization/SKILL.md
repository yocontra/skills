---
name: coreml-optimization
effort: medium
description: Core ML and Apple Neural Engine work on iOS/macOS — coremltools conversion (ct.convert), ANE placement and computeUnits, split einsum attention, palettization/INT4/joint compression of .mlpackage, stateful KV-cache models, MLComputePlan profiling, Apple Foundation Models. GGUF, AWQ, GPTQ, ONNX, ExecuTorch → model-quantization.
---

$ARGUMENTS

# Core ML and Apple Neural Engine optimization

Getting models onto the Apple Neural Engine (ANE) efficiently: convert, compress, place,
profile. Cross-platform quantization (AWQ, GPTQ, GGUF, ONNX, ExecuTorch), mobile model
selection, and generic memory math belong to the `model-quantization` skill; this skill
covers what is specific to Core ML and Apple silicon.

## How to work

Do the work, then report. For a conversion or optimization task:

1. Read the model code and any existing conversion script. Note the architecture (attention,
   recurrent layers, vocab size), input shapes, target OS, and target chips. Where the
   request leaves these open, pick defaults (fixed shapes, iOS 18 target, `.all` compute
   units, 4-bit palettization) and list them under Assumptions.
2. Convert with `torch.jit.trace` unless the model already exports cleanly with
   `torch.export`. Keep the `.mlpackage` as the source artifact.
3. Restructure for the ANE where the architecture calls for it: fixed or enumerated shapes,
   split einsum attention, chunked vocab projections.
4. Compress the `.mlpackage` (palettize, linear-quantize, or joint-compress), then compile.
5. Check placement with `MLComputePlan` and quality with the project's eval set against the
   FP16 model.
6. Report which compute unit each hot path landed on, size before and after, quality delta,
   latency on device (never the simulator), what was changed, and the assumptions made.

## ANE mental model

The ANE is a convolution engine. It thinks in `[1, C, 1, S]` (batch, channels, 1, spatial),
and everything maps to convolution internally.

Hard limits:

- Maximum 5D tensors.
- 16,384 maximum per dimension.
- About 32 MB per tensor; larger tensors are rejected to CPU/GPU.
- An op set significantly smaller than the GPU's.
- A maximum program size; models above it must be split into chunks.

Reshape, transpose, and permute are free on CPU but wreck ANE performance: they force the
runtime to move computation off the ANE. A model with many reshapes in hot paths gets
little from the ANE.

Runs well on ANE: convolutions, matrix multiplications (mapped to conv), element-wise ops,
concatenation along the channel dim, pooling.

Falls back to CPU/GPU: complex reshapes, gather/scatter, most recurrent ops (LSTM/GRU),
dynamic shapes, unsupported activations.

## Split einsum

Standard attention (`bnqd,bnkd->bnqk`) needs reshapes and transposes that push work off
the ANE. Split einsum reformulates it to `bchq,bkhc->bkhq`, a layout that maps directly onto
the ANE's convolution path. It is an architecture-level transform from Apple's
`ml-stable-diffusion` project, not a coremltools parameter. Variants: `ORIGINAL`
(CPU/GPU), `SPLIT_EINSUM`, and `SPLIT_EINSUM_V2` (10–30% faster on mobile ANE by processing
several heads at once; only available through `ml-stable-diffusion`'s pipeline). Expect
2–4x attention speedup on the ANE.

| Scenario | Split einsum? | Variant |
|----------|---------------|---------|
| SD 1.5 / 2.x UNet | Yes | `SPLIT_EINSUM_V2` |
| Custom transformer with Q/K/V attention | Yes | `SPLIT_EINSUM_V2` (or the manual rewrite) |
| SDXL UNet | Yes for ANE (iPhone/iPad), `ORIGINAL` for Mac GPU | `SPLIT_EINSUM`; never `SPLIT_EINSUM_V2`, whose compile time is prohibitive on SDXL |
| Small models where CPU is fine | No | Overhead not worth it |
| Non-attention models (CNNs, RNNs) | N/A | No attention to split |

The `torch2coreml` command and the manual rewrite for custom transformers are in
[split-einsum.md](references/split-einsum.md).

## Compute units

Set `MLModelConfiguration().computeUnits`; `.all` is the default and lets Core ML choose per op.

| Compute units | When | Typical models |
|---------------|------|----------------|
| `.all` | Default; start here | Most models |
| `.cpuAndNeuralEngine` | Force the ANE path, skip GPU | Image-gen UNet, vision CNNs |
| `.cpuAndGPU` | ANE lacks ops or the model exceeds ANE limits | Large-vocab LLMs, complex activations |
| `.cpuOnly` | Simulator, debugging, precision-critical paths | LSTM state, STFT/iSTFT |

| Model type | Recommended | Notes |
|------------|-------------|-------|
| LLM prefill | `.cpuAndNeuralEngine` | Bulk matmul maps well to ANE |
| LLM decode | `.cpuAndGPU` | Sequential, small batches suit GPU |
| Diffusion UNet | `.cpuAndNeuralEngine` | With split einsum attention |
| Diffusion VAE | `.cpuAndGPU` | GroupNorm, complex activations |
| Diffusion text encoder | `.all` | Small; let the runtime decide |
| TTS encoder | `.all` | Usually small enough for ANE |
| TTS decoder | `.cpuOnly` or `.all` | LSTM/GRU often CPU-only |
| ASR (Whisper) | `.all` | Encoder on ANE, decoder mixed |
| Vision CNN | `.cpuAndNeuralEngine` | Conv-heavy, the ANE's strength |
| Depth estimation | `.all` | Depends on architecture |

Workload-specific guidance (LLM disaggregated inference and ANEMLL, diffusion components and
memory, audio streaming and DSP) is in [workloads.md](references/workloads.md).

## Compression with coremltools

All three paths use `coremltools.optimize.coreml` (`cto`) on a saved `.mlpackage` converted
with `minimum_deployment_target=ct.target.iOS18` or later; on an iOS 17 model coremltools
raises for per-grouped-channel palettization, per-channel scale, INT4, per-block, and joint
compression. Full configs are in [compression.md](references/compression.md).

| Goal | API | Key settings |
|------|-----|--------------|
| Best for ANE | `cto.palettize_weights` + `OpPalettizerConfig` | `mode="kmeans"`, `nbits=4`, `granularity="per_grouped_channel"`, `group_size=16`, `enable_per_channel_scale=True` |
| Best for GPU | `cto.linear_quantize_weights` + `OpLinearQuantizerConfig` | `mode="linear_symmetric"`, `dtype="int4"`, `granularity="per_block"`, `block_size=32` |
| A17 Pro / M4 and newer | palettize, then `linear_quantize_weights(..., joint_compression=True)` | INT8 linear quant at `granularity="per_tensor"` (joint compression requires per-tensor) |

- Palettization clusters weights into 2^n centroids; the ANE has hardware support for
  palettized lookups. `nbits` accepts 1, 2, 3, 4, 6, 8; 4 is the sweet spot, 2 works for
  non-critical layers, 6 or 8 for sensitive ones.
- Joint compression (A8W4) makes the LUT entries themselves INT8, which triggers the fast
  int8×int8 ANE datapath on A17 Pro / M4 and newer: roughly 2x throughput over standard
  4-bit at 4-bit effective weight precision.

Rules that hold for every path:

1. Palettize the `.mlpackage` before compiling to `.mlmodelc`; the compiler needs the
   palettization metadata.
2. Save palettized models with `compute_units=ct.ComputeUnit.CPU_ONLY`; the ANE can hang
   during `.save()` with palettized weights.
3. Keep the `.mlpackage`. macOS updates break `.mlmodelc`, and recompiling needs the source.
4. Run the eval suite after compressing. Quality is measured, not assumed.

For choosing a bit width or method in general (AWQ vs GPTQ vs GGUF, per-model quality
thresholds, perplexity numbers), see the `model-quantization` skill.

## Conversion

- `torch.jit.trace` + `ct.convert` is the stable path with full op coverage.
  `torch.export` auto-infers shapes and supports `torch.export.Dim()` for dynamic shapes, but
  its op coverage is still growing; keep `jit.trace` as the fallback.
- Use fixed shapes for the ANE, `ct.EnumeratedShapes` when a few sizes are needed, and
  `ct.RangeDim` only for GPU/CPU targets — flexible shapes often prevent ANE execution.
- Compile with `xcrun coremlcompiler compile model.mlpackage output_dir/`. The `.mlmodelc`
  is tied to the compilation host's macOS version.
- Deployment targets: `ct.target.iOS16` (mlprogram, basic ANE ops), `iOS17`
  (MLComputePlan, expanded op set), `iOS18` (stateful models, per-grouped-channel
  palettization, INT4 and per-block quantization, joint compression).
- Stateful models (iOS 18+) register the KV cache with `register_buffer`, convert with
  `ct.StateType`, and run with `model.makeState()`; see
  [stateful-models.md](references/stateful-models.md).

Code for each path, flexible shapes, and compilation is in
[conversion.md](references/conversion.md).

## Profiling

`MLComputePlan` (iOS 17+) reports the preferred device and estimated cost for every op;
look for ops on CPU that should be on the ANE and reshape/transpose ops that break ANE
execution chains. Instruments' Core ML template shows compute-unit switches (expensive),
memory spikes, and ANE utilization gaps. Code for both plus a resident-memory logger is in
[profiling.md](references/profiling.md).

## Apple Foundation Models

iOS 26+ ships a free on-device ~3B language model through the `FoundationModels` framework
(`LanguageModelSession`, `@Generable` structured output, the `Tool` protocol). Use it for
general text tasks, prototyping, and iOS-26-only targets on Apple Intelligence devices; use
a custom model for domain specialization, fine-tuned behavior, specific architectures,
languages it does not support, or older OS and device support. API usage is in
[foundation-models.md](references/foundation-models.md).

## Common pitfalls

1. macOS upgrades break `.mlmodelc`: precompiled models use a MIL format tied to the
   compilation host. Recompile from the `.mlpackage` with `xcrun coremlcompiler compile`
   after OS updates.
2. Large vocab projections are rejected by the ANE: embedding or projection layers over 16K
   channels (common in LLMs with 32K+ vocabularies) exceed the dimension limit. Split into
   chunks or keep them on GPU.
3. FP16 accumulation error: long LLM sequences accumulate FP16 rounding error. Consider FP32
   for the final logits projection.
4. coremltools versions break between majors; pin one. 9.0 is tested up to PyTorch 2.7
   (newer versions warn) and has wider `torch.export` coverage than 8.x. `pip install
   coremltools` gets the current stable; `pip install coremltools==<version>` pins.
5. `torch.export` op coverage is incomplete; keep `torch.jit.trace` as the fallback.
6. The simulator runs CPU only. `.cpuAndNeuralEngine` falls back to CPU there, so never
   benchmark on the simulator.
7. Flexible shapes (`RangeDim`) often prevent ANE execution; use fixed or enumerated shapes.
8. Models too large for one ANE program must be split into chunks. ANEMLL does this
   automatically for LLMs.
