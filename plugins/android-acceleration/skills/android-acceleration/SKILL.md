---
name: android-acceleration
description: On-device AI inference on Android NPUs, GPUs and CPUs — ExecuTorch (XNNPACK, Qualcomm QNN, MediaTek NeuroPilot, Exynos), LiteRT, LiteRT-LM, ONNX Runtime Mobile, Gemini Nano (ML Kit GenAI). Use for .pte export, backend quantizers (QNN, XNNPACK, NeuroPilot), NPU delegation, JNI inference bridges, backend fallback, and Android inference profiling.
effort: medium
---

$ARGUMENTS

# Android hardware-accelerated AI inference

Get a model running fast on real Android devices across a fragmented NPU landscape.
Pick the backend from the target chipsets, export with that backend's quantizer, ship a
CPU fallback, and test on the device tiers your users actually own. Write the export
script, Gradle setup and runtime code the task needs, then report which backends were
targeted, which fallback ships, and which devices still need testing.

## NPU landscape

| Chipset | NPU | Primary framework | Best quantization | Devices |
|---------|-----|-------------------|-------------------|---------|
| Snapdragon 8 Gen 3 (SM8650) | Hexagon (HTP) | ExecuTorch + QNN | INT8 / INT4 | Galaxy S24 Ultra, OnePlus 12 |
| Snapdragon 8 Elite (SM8750) | Hexagon (HTP) | ExecuTorch + QNN | INT8 / INT4 | Galaxy S25, 2025 flagships |
| Snapdragon 8 Elite Gen 5 (SM8850) | Hexagon (HTP) | ExecuTorch + QNN | INT8 / INT4 | Late-2025/2026 flagships |
| Dimensity 9300/9400/9500 | NeuroPilot (APU) | ExecuTorch + MediaTek | INT4–INT16 | Vivo X200, OPPO Find |
| Exynos 2500/2600 | Samsung NPU | ExecuTorch + Samsung (Exynos AI LiteCore) | INT8 / INT16 | Samsung phones with those SoCs |
| Tensor G4/G5 | Google TPU | LiteRT / Gemini Nano | INT8 | Pixel 9 / Pixel 10 series |
| Any (CPU fallback) | XNNPACK | ExecuTorch | INT8 / INT4 | All Android devices |

NNAPI is deprecated. Do not build new integrations on it, even though tutorials still
show it; delegate directly through ExecuTorch backends or LiteRT delegates.

Most users will hit XNNPACK on the CPU. NPU backends are flagship-only, so every
shipped model has a CPU fallback.

## Choosing a framework

| Situation | Use | Reference |
|-----------|-----|-----------|
| PyTorch model, broad device coverage | ExecuTorch + XNNPACK `.pte` | [executorch.md](references/executorch.md) |
| Snapdragon flagship NPU | ExecuTorch + QNN, or ONNX Runtime QNN EP | [executorch.md](references/executorch.md), [runtimes.md](references/runtimes.md) |
| Dimensity flagship NPU | ExecuTorch + MediaTek NeuroPilot | [executorch.md](references/executorch.md) |
| Pixel, GPU delegate, TFLite heritage | LiteRT | [runtimes.md](references/runtimes.md) |
| ONNX model, cross-platform | ONNX Runtime Mobile | [runtimes.md](references/runtimes.md) |
| Gemma-class LLM on GPU/NPU, minimal integration | LiteRT-LM (replaces MediaPipe LLM Inference) | [runtimes.md](references/runtimes.md) |
| Short summarize/proofread/prompt tasks on supported devices | Gemini Nano via ML Kit GenAI | [runtimes.md](references/runtimes.md) |
| C++ engine (llama.cpp, whisper.cpp, custom) | JNI bridge | [jni-bridge.md](references/jni-bridge.md) |

## Rules that decide whether it works

- **Delegation is baked in at export.** An ExecuTorch `.pte` carries its backend
  partitioning; the Android runtime uses whatever the file was compiled for. Backend
  choice is an export-time decision, so one `.pte` per backend.
- **Use the backend's own quantizer**, not generic quantization. QNN HTP needs INT8 QDQ
  from `QnnQuantizer` and does not run FP32. XNNPACK prefers symmetric INT8 from
  `XNNPACKQuantizer`. MediaTek takes `NeuropilotQuantizer` precisions such as A16W4.
- **QNN binds to a chipset at compile time.** A model compiled for `SM8650` will not run
  on `SM8550`. Compile per target SoC (recent ExecuTorch can also pack a known list of
  SoCs into one flexible context binary) and fall back to XNNPACK elsewhere. The build
  machine needs the QNN SDK.
- **MediaTek and Samsung compilation need a Linux x86-64 host.** Their SDK wheels do not
  install on macOS; use a Linux box, VM or CI runner.
- **Exynos is second priority.** ExecuTorch's Samsung backend covers only Exynos 2500 and
  2600 (not the Exynos 2400 in many Galaxy S24s), needs Samsung's Exynos AI LiteCore SDK,
  and many Samsung flagships sold globally are Snapdragon. For those, use QNN.
- **Play Services runtimes need Google Play.** LiteRT or Gemini Nano via Play Services
  fails on Huawei, Amazon Fire and sideloaded devices; bundle the runtime for broad reach.

## Fallback strategy

Select the fastest backend that is available and has a model file, ending at XNNPACK:

```kotlin
sealed class InferenceBackend {
    abstract fun load(modelPath: String): Boolean
    abstract fun infer(input: FloatArray): FloatArray
    abstract fun destroy()
}

fun selectBackend(modelBasePath: String): InferenceBackend = when {
    // Qualcomm NPU — Snapdragon
    QnnBackend.isAvailable() && fileExists("${modelBasePath}_qnn.pte") ->
        QnnBackend("${modelBasePath}_qnn.pte")
    // MediaTek NPU — Dimensity
    NeuroPilotBackend.isAvailable() && fileExists("${modelBasePath}_mtk.pte") ->
        NeuroPilotBackend("${modelBasePath}_mtk.pte")
    // GPU delegate — broad support
    GpuBackend.isSupported() && fileExists("${modelBasePath}_gpu.tflite") ->
        GpuBackend("${modelBasePath}_gpu.tflite")
    // XNNPACK CPU — always works
    else -> XnnpackBackend("${modelBasePath}_xnnpack.pte")
}
```

| Approach | Binary size | Performance | Compatibility |
|----------|------------|-------------|---------------|
| XNNPACK only | Small (~5 MB runtime) | Good (CPU) | 100% of devices |
| XNNPACK + GPU | Medium (~8 MB) | Better | ~80% of devices |
| XNNPACK + QNN | Medium (~10 MB) | Best on Snapdragon | Snapdragon + fallback |
| All backends | Large (~20 MB+) | Adaptive | Maximum coverage |

Default: bundle the XNNPACK `.pte`, add a QNN `.pte` for Snapdragon flagships when the
size budget allows, and download other NPU-specific variants on demand rather than
bundling them. Three 500 MB variants bundled is a 1.5 GB download.

## Test matrix

Cover every path the fallback can take:

- **Flagship**: Snapdragon 8 Gen 3 / 8 Elite (QNN/NPU path)
- **Mid-range**: Snapdragon 7 Gen 2/3 or Dimensity 7000 (GPU/CPU path)
- **Budget**: older Snapdragon 6xx or MediaTek Helio (CPU-only path)
- **Pixel**: Tensor G3/G4/G5 (LiteRT path)

A QNN model that flies on an S24 Ultra can crash on a Pixel 7a; the CPU path is where
most users live. Run sustained inference for 5+ minutes, since thermal throttling can
drop 60 fps to 15 fps after ten seconds. Profiling tools, Perfetto capture and target
metrics are in [profiling.md](references/profiling.md).

## Common pitfalls

1. Testing only on a flagship, so the CPU fallback is never exercised.
2. Ignoring thermal throttling: short benchmarks hide sustained-performance drops.
3. Bundling every model variant instead of downloading non-default backends on demand.
4. QNN compile target mismatch (`SM8650` vs `SM8550`).
5. JNI memory leaks from native objects never destroyed; implement `AutoCloseable`
   and use `use {}` or try-finally.
6. Generic quantization instead of the backend's quantizer.
7. New NNAPI delegation.
8. Depending on Play Services where Google Play is absent.

When inference is wrong or crashes and the cause is not obvious, find the root cause
before changing backends or quantization.
