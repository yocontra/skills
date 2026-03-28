---
name: android-acceleration
description: |
  Deep guide for hardware-accelerated AI inference on Android.
  Use when deploying models to Android with ExecuTorch, QNN (Qualcomm Hexagon NPU), MediaTek NeuroPilot,
  Samsung Exynos NPU, LiteRT (TFLite successor), ONNX Runtime Mobile, or Gemini Nano.
  Covers NPU delegation, quantization for mobile backends, JNI bridge patterns, fallback strategies,
  and profiling. Works with LLMs, diffusion, TTS, ASR, vision, and embedding models.
---

# Android Hardware-Accelerated AI Inference

Navigating Android's fragmented NPU landscape to get models running fast on real devices.

## Android NPU Landscape

| Chipset | NPU | Primary Framework | Best Quantization | Devices |
|---------|-----|-------------------|-------------------|---------|
| Snapdragon 8 Gen 3 | Hexagon (HTP) | ExecuTorch + QNN | INT8 / INT4 | Galaxy S24, OnePlus 12 |
| Snapdragon 8 Gen 4 | Hexagon (HTP) | ExecuTorch + QNN | INT8 / INT4 | Galaxy S25, 2025 flagships |
| Dimensity 9300/9400 | NeuroPilot (APU) | ExecuTorch + MediaTek | INT4-INT16 | Vivo X200, OPPO Find |
| Dimensity 9500 | NeuroPilot (APU) | ExecuTorch + MediaTek | INT4-INT16 | 2025/2026 flagships |
| Exynos 2400/2600 | Samsung NPU | ExecuTorch | INT8 | Galaxy S24 (some regions) |
| Tensor G4 | Google TPU | LiteRT / Gemini Nano | INT8 | Pixel 9 series |
| Any (CPU fallback) | XNNPACK | ExecuTorch | INT8 / INT4 | All Android devices |

**NNAPI is deprecated.** Do not build new integrations on NNAPI. Use direct backend delegation via ExecuTorch or LiteRT instead.

**Reality**: Most of your users will hit XNNPACK (CPU). NPU backends are flagship-only. Always ship a CPU fallback.

---

## ExecuTorch Core Pipeline

ExecuTorch is PyTorch's official on-device inference framework. Export from Python, run on device.

### Basic Export (XNNPACK / CPU)

```python
import torch
from torch.export import export
from executorch.backends.xnnpack.partition.xnnpack_partitioner import XnnpackPartitioner
from executorch.exir import to_edge_transform_and_lower, EdgeCompileConfig

# Step 1: Export model
model.eval()
sample_inputs = (torch.randn(1, 3, 224, 224),)
exported = export(model, sample_inputs)

# Step 2: Edge transform + XNNPACK delegation
edge = to_edge_transform_and_lower(
    exported,
    partitioner=[XnnpackPartitioner()],
    compile_config=EdgeCompileConfig(_check_ir_validity=False),
)

# Step 3: Serialize to .pte file
exec_prog = edge.to_executorch()
with open("model.pte", "wb") as f:
    exec_prog.write_to_file(f)
```

The `.pte` file contains the model graph with delegation info baked in. Backend selection happens at export time, not runtime.

---

## XNNPACK Backend (CPU — Universal Fallback)

Works on every Android device. Optimized for ARM NEON, SVE, and SME instructions.

### INT8 Symmetric Quantization (PT2E Flow)

```python
from torch.export import export
from torchao.quantization.pt2e.quantize_pt2e import convert_pt2e, prepare_pt2e
from executorch.backends.xnnpack.quantizer.xnnpack_quantizer import (
    get_symmetric_quantization_config,
    XNNPACKQuantizer,
)
from executorch.backends.xnnpack.partition.xnnpack_partitioner import XnnpackPartitioner
from executorch.exir import to_edge_transform_and_lower, EdgeCompileConfig

# Step 1: Export for quantization (two-stage export)
model_to_quantize = export(model.eval(), sample_inputs).module()

# Step 2: Configure quantizer
quantizer = XNNPACKQuantizer()
quantizer.set_global(get_symmetric_quantization_config(
    is_per_channel=True,   # Per-channel is better quality
    is_dynamic=False,       # Static quantization (needs calibration)
))

# Step 3: Prepare + calibrate + convert
prepared = prepare_pt2e(model_to_quantize, quantizer)
for batch in calibration_dataloader:
    prepared(*batch)  # Run calibration data through model
quantized = convert_pt2e(prepared)

# Step 4: Export to ExecuTorch
exported = export(quantized, sample_inputs)
edge = to_edge_transform_and_lower(
    exported,
    partitioner=[XnnpackPartitioner()],
    compile_config=EdgeCompileConfig(_check_ir_validity=False),
)
exec_prog = edge.to_executorch()
with open("model_int8.pte", "wb") as f:
    exec_prog.write_to_file(f)
```

### INT4 Groupwise Quantization (torchao)

For LLMs — 2x decode speedup, 5x prefill improvement over FP32.

```python
from torchao.quantization import Int4WeightOnlyConfig, quantize_

# Quantize model weights to INT4 with group_size=32
model.eval()
quantize_(model, Int4WeightOnlyConfig(group_size=32))

# Then export normally
exported = export(model, sample_inputs)
edge = to_edge_transform_and_lower(exported, partitioner=[XnnpackPartitioner()])
edge.to_executorch().write_to_file(open("model_int4.pte", "wb"))
```

**group_size**: 32 (standard), 64 (slightly worse quality, smaller), 128 (most compact). Start with 32.

---

## QNN Backend (Qualcomm Hexagon NPU)

For Snapdragon devices. Runs on the Hexagon Tensor Processor (HTP) — dedicated NPU silicon.

```python
from torch.export import export
from torchao.quantization.pt2e.quantize_pt2e import convert_pt2e, prepare_pt2e
from executorch.backends.qualcomm.utils.utils import (
    generate_qnn_executorch_compiler_spec,
    generate_htp_compiler_spec,
    QcomChipset,
    to_edge_transform_and_lower_to_qnn,
)
from executorch.backends.qualcomm.quantizer.quantizer import QnnQuantizer

# Step 1: Quantize for HTP (requires INT8 QDQ format)
quantizer = QnnQuantizer()
prepared = prepare_pt2e(
    export(model.eval(), sample_inputs, strict=True).module(),
    quantizer,
)
for batch in calibration_dataloader:
    prepared(*batch)
quantized = convert_pt2e(prepared)

# Step 2: Compile for target chipset
backend_options = generate_htp_compiler_spec(use_fp16=False)
compile_spec = generate_qnn_executorch_compiler_spec(
    soc_model=QcomChipset.SM8650,  # Snapdragon 8 Gen 3
    backend_options=backend_options,
)

# Step 3: Delegate and export
delegated = to_edge_transform_and_lower_to_qnn(
    quantized, sample_inputs, compile_spec,
)
exec_prog = delegated.to_executorch()
with open("model_qnn.pte", "wb") as f:
    exec_prog.write_to_file(f)
```

### Chipset Targets

| QcomChipset | SoC | Devices |
|-------------|-----|---------|
| `SM8650` | Snapdragon 8 Gen 3 | Galaxy S24, OnePlus 12, Xiaomi 14 |
| `SM8750` | Snapdragon 8 Gen 4 | Galaxy S25, 2025 flagships |
| `SM7550` | Snapdragon 7+ Gen 3 | Mid-range 2024-2025 |

**Requirements**: QNN SDK on build machine, INT8 quantized model (HTP doesn't support FP32), target chipset must be specified at compile time.

**FP16 on HTP**: Pass `use_fp16=True` to `generate_htp_compiler_spec()` — available on newer chipsets but INT8 is faster and preferred.

---

## MediaTek NeuroPilot Backend

For Dimensity chipsets (9300, 9400, 9500).

```python
from executorch.backends.mediatek.quantizer import NeuropilotQuantizer, Precision
from torchao.quantization.pt2e.quantize_pt2e import convert_pt2e, prepare_pt2e
from torch.export import export

# Step 1: Quantize with NeuroPilot quantizer
quantizer = NeuropilotQuantizer()
quantizer.setup_precision(Precision.A16W4)
# Options: A16W16, A16W8, A16W4, A8W8, A8W4

prepared = prepare_pt2e(export(model, sample_inputs).module(), quantizer)
for batch in calibration_dataloader:
    prepared(*batch)
quantized = convert_pt2e(prepared)

# Step 2: Standard ExecuTorch export with MediaTek partitioner
# (use MediaTek-provided partitioner)
```

**Critical**: MediaTek backend compilation requires a **Linux host** — does not work on macOS.

### Benchmarks (Dimensity 9500)

| Metric | Value |
|--------|-------|
| Prefill (Llama 3B) | 1600 tok/s |
| Decode (Llama 3B) | 28 tok/s |
| Power efficiency | 3x better than GPU |

---

## Android Runtime Integration

### Gradle Setup

```kotlin
// build.gradle.kts
dependencies {
    implementation("org.pytorch:executorch-android:0.6.0")
    // Includes: XNNPACK, portable ops, quantized ops
    // Architectures: arm64-v8a, x86_64
}
```

### Java Inference

```java
import org.pytorch.executorch.EValue;
import org.pytorch.executorch.Module;
import org.pytorch.executorch.Tensor;

// Load model
Module module = Module.load(assetFilePath("model.pte"));

// Prepare input
float[] inputData = new float[]{1.0f, 2.0f, 3.0f};
long[] inputShape = new long[]{1, 3};
Tensor inputTensor = Tensor.fromBlob(inputData, inputShape);

// Run inference
EValue[] result = module.forward(EValue.from(inputTensor));

// Read output
float[] output = result[0].toTensor().getDataAsFloatArray();
```

### Kotlin Inference

```kotlin
import org.pytorch.executorch.Module
import org.pytorch.executorch.Tensor
import org.pytorch.executorch.EValue

val module = Module.load(modelPath)

val input = Tensor.fromBlob(
    floatArrayOf(1.0f, 2.0f, 3.0f),
    longArrayOf(1, 3)
)

val outputs = module.forward(EValue.from(input))
val result = outputs[0].toTensor().dataAsFloatArray
```

**Key point**: Backend delegation is baked into the `.pte` file at export time. The Android runtime automatically uses whatever backend the model was compiled for (XNNPACK, QNN, MediaTek, etc.).

---

## LiteRT (TFLite Successor)

Google's lightweight runtime — the successor to TensorFlow Lite. Good for Pixel devices and broad compatibility.

### PyTorch → LiteRT Conversion

```python
import litert_torch

model.eval()
edge_model = litert_torch.convert(model, sample_inputs)
edge_model.export("model.tflite")
```

### Android Runtime with GPU Delegate

```kotlin
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.gpu.GpuDelegate

val compatList = CompatibilityList()
val options = Interpreter.Options().apply {
    if (compatList.isDelegateSupportedOnThisDevice) {
        addDelegate(GpuDelegate(compatList.bestOptionsForThisDevice))
    } else {
        setNumThreads(4)  // CPU fallback
    }
}

val interpreter = Interpreter(modelBuffer, options)
interpreter.run(inputBuffer, outputBuffer)
```

### Gradle

```kotlin
dependencies {
    // Standalone (bundled in APK)
    implementation("com.google.ai.edge.litert:litert:2.1.0")
    implementation("com.google.ai.edge.litert:litert-gpu:2.1.0")

    // OR Play Services (smaller APK, Google-managed runtime)
    implementation("com.google.android.gms:play-services-tflite-java:16.4.0")
    implementation("com.google.android.gms:play-services-tflite-gpu:16.4.0")
}
```

### Play Services Variant

```kotlin
import org.tensorflow.lite.InterpreterApi
import org.tensorflow.lite.TfLiteRuntime
import org.tensorflow.lite.gpu.GpuDelegateFactory

val options = InterpreterApi.Options()
    .setRuntime(TfLiteRuntime.FROM_SYSTEM_ONLY)
    .addDelegateFactory(GpuDelegateFactory())

val interpreter = InterpreterApi.create(modelBuffer, options)
```

**Play Services advantage**: Smaller APK (runtime provided by Google Play). **Disadvantage**: Requires Google Play Services (not available on all devices).

---

## ONNX Runtime Mobile

Cross-platform runtime with multiple execution providers.

### Android Setup

```kotlin
dependencies {
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.18.0")
}
```

### Kotlin Inference

```kotlin
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import java.nio.FloatBuffer

val env = OrtEnvironment.getEnvironment()
val session = env.createSession(modelBytes)

val inputBuffer = FloatBuffer.wrap(floatArrayOf(1.0f, 2.0f, 3.0f))
val inputTensor = OnnxTensor.createTensor(env, inputBuffer, longArrayOf(1, 3))

val results = session.run(mapOf("input" to inputTensor))
val output = (results[0].value as Array<FloatArray>)[0]
```

### QNN Execution Provider (Qualcomm NPU)

```python
# Python — for model optimization/testing
import onnxruntime as ort

session = ort.InferenceSession(
    "model.onnx",
    providers=["QNNExecutionProvider"],
    provider_options=[{
        "backend_path": "libQnnHtp.so",          # Hexagon NPU
        "htp_performance_mode": "burst",           # burst, sustained_high, sustained_low
        "soc_model": "SM8650",                     # Target chipset
    }],
)
output = session.run(None, {"input": input_array})
```

### Context Binary Caching

Pre-compile the model for faster subsequent loads:

```python
options = ort.SessionOptions()
options.add_session_config_entry("ep.context_enable", "1")
options.add_session_config_entry("ep.context_embed_mode", "1")  # Embed in ONNX file
# First run compiles; subsequent runs load from cache
```

---

## Gemini Nano (ML Kit GenAI)

Google's on-device LLM, available through ML Kit.

```kotlin
// build.gradle.kts — AI Edge Local Agents SDK (standalone, not Play Services)
dependencies {
    implementation("com.google.ai.edge.localagents:localagents-genai:0.1.0")
}
```

```kotlin
import com.google.ai.edge.localagents.genai.GenerativeModel

// Setup
val model = GenerativeModel.Builder()
    .setModelPath("/data/local/tmp/gemma-3n-E4B-it-int4.task")
    .build()

// Non-streaming (suspend function)
val response = model.generateContent("Summarize this text: ...")
val text = response.text

// Streaming
model.generateContentStream("Tell me about...").collect { chunk ->
    val partialText = chunk.text
    // Update UI incrementally
}
```

**Note**: The Gemini Nano / on-device GenAI API surface has changed significantly across releases. There are multiple SDK paths: Play Services GenAI (`com.google.android.gms:play-services-genai`), AI Edge standalone (`com.google.ai.edge.localagents`), and ML Kit GenAI (`com.google.mlkit:genai-prompt`). Always check the latest [Google AI Edge documentation](https://ai.google.dev/edge) for current API signatures and the correct artifact for your use case.

### Limitations

| Constraint | Value |
|-----------|-------|
| Max input tokens | 4,000 |
| Max output tokens | 256 |
| Supported devices | Pixel 8+, select Samsung flagships |
| System prompt | Combined with user prompt (no separate field) |
| Fine-tuning | Not available |
| Quota | Per-app, Google-managed |
| Status | Beta — API surface is still changing |

**When to use**: Quick text summarization, proofreading, simple prompts on supported devices. **When to skip**: Custom models, long generation, broad device support, production reliability.

---

## MediaPipe LLM Inference API

Google's alternative to ExecuTorch for on-device LLM inference, optimized for Gemma models.

```kotlin
// build.gradle.kts
dependencies {
    // Check https://maven.google.com for latest version
    implementation("com.google.mediapipe:tasks-genai:0.10.22")
}
```

```kotlin
import com.google.mediapipe.tasks.genai.llminference.LlmInference

val options = LlmInference.LlmInferenceOptions.builder()
    .setModelPath("/data/local/tmp/gemma-2b-it-gpu-int4.bin")
    .setMaxTokens(1024)
    .setTopK(40)
    .setTemperature(0.8f)
    .build()

val llm = LlmInference.createFromOptions(context, options)

// Synchronous
val response = llm.generateResponse("What is the capital of France?")

// Streaming
llm.generateResponseAsync("Tell me a story") { partialResult ->
    // partialResult: partial text generated so far
    updateUI(partialResult)
}
// Note: verify callback signature against your mediapipe version — API has evolved
```

**When to use**: Deploying Gemma models on Android with GPU acceleration. Simpler than ExecuTorch if you're specifically using Gemma. **When to skip**: Non-Gemma models, NPU targeting, maximum performance.

---

## Samsung Exynos NPU

Samsung NPU delegation through ExecuTorch is still maturing. As of early 2026:

- **Supported chipsets**: Exynos 2400, Exynos 2600 (Samsung SF2 process)
- **Framework**: ExecuTorch with Samsung backend (limited public documentation)
- **Quantization**: INT8 preferred
- **Reality**: Most Samsung flagships sold globally use Snapdragon, not Exynos. Focus QNN optimization first, Exynos second.

For Samsung devices with Snapdragon chips, use the QNN backend instead.

---

## JNI Bridge Patterns

For running C++ inference engines (llama.cpp, whisper.cpp, custom) from Kotlin.

### Kotlin Side

```kotlin
class NativeInference private constructor(
    private var nativePtr: Long
) : AutoCloseable {

    companion object {
        init { System.loadLibrary("inference") }

        fun create(modelPath: String): NativeInference {
            val ptr = nativeCreate(modelPath)
            if (ptr == 0L) throw RuntimeException("Failed to load model")
            return NativeInference(ptr)
        }

        @JvmStatic private external fun nativeCreate(path: String): Long
        @JvmStatic private external fun nativeInfer(ptr: Long, input: FloatArray): FloatArray
        @JvmStatic private external fun nativeDestroy(ptr: Long)
    }

    fun infer(input: FloatArray): FloatArray {
        check(nativePtr != 0L) { "Model already destroyed" }
        return nativeInfer(nativePtr, input)
    }

    override fun close() {
        if (nativePtr != 0L) {
            nativeDestroy(nativePtr)
            nativePtr = 0
        }
    }
}

// Usage: auto-cleanup with use {}
NativeInference.create(modelPath).use { model ->
    val output = model.infer(inputData)
}
```

### C++ Side (JNI)

```cpp
#include <jni.h>
#include "model.h"  // Your inference engine

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_example_NativeInference_nativeCreate(JNIEnv *env, jclass, jstring path) {
    const char *modelPath = env->GetStringUTFChars(path, nullptr);
    auto *model = new Model(modelPath);
    env->ReleaseStringUTFChars(path, modelPath);
    return reinterpret_cast<jlong>(model);
}

JNIEXPORT jfloatArray JNICALL
Java_com_example_NativeInference_nativeInfer(JNIEnv *env, jclass, jlong ptr, jfloatArray input) {
    auto *model = reinterpret_cast<Model *>(ptr);

    // Zero-copy input access
    jfloat *inputData = env->GetFloatArrayElements(input, nullptr);
    jsize inputLen = env->GetArrayLength(input);

    // Run inference
    std::vector<float> output = model->infer(inputData, inputLen);
    env->ReleaseFloatArrayElements(input, inputData, JNI_ABORT);

    // Return output
    jfloatArray result = env->NewFloatArray(output.size());
    env->SetFloatArrayRegion(result, 0, output.size(), output.data());
    return result;
}

JNIEXPORT void JNICALL
Java_com_example_NativeInference_nativeDestroy(JNIEnv *, jclass, jlong ptr) {
    delete reinterpret_cast<Model *>(ptr);
}

}  // extern "C"
```

### Key Rules

1. **`ByteBuffer.allocateDirect()`** for large data transfers — avoids JNI copy overhead
2. **`JavaVM` + `GetEnv()`** for multi-threaded C++ — `JNIEnv*` is thread-local
3. **Always pair create/destroy** — JNI pointers are manual memory management
4. **`JNI_ABORT`** on `ReleaseFloatArrayElements` when you only read (no copy-back)
5. **Don't hold JNI references across threads** — use `NewGlobalRef` if needed

### CMake Setup

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.18)
project(inference)

add_library(inference SHARED
    jni_bridge.cpp
    model.cpp
)

target_link_libraries(inference
    android
    log
)
```

```kotlin
// build.gradle.kts
android {
    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
        }
    }
}
```

---

## Fallback Strategy

Android NPU support is fragmented. Always plan for graceful degradation.

```kotlin
sealed class InferenceBackend {
    abstract fun load(modelPath: String): Boolean
    abstract fun infer(input: FloatArray): FloatArray
    abstract fun destroy()
}

fun selectBackend(modelBasePath: String): InferenceBackend {
    // Try backends in order of performance
    return when {
        // Qualcomm NPU — best for Snapdragon devices
        QnnBackend.isAvailable() && fileExists("${modelBasePath}_qnn.pte") ->
            QnnBackend("${modelBasePath}_qnn.pte")

        // MediaTek NPU — best for Dimensity devices
        NeuroPilotBackend.isAvailable() && fileExists("${modelBasePath}_mtk.pte") ->
            NeuroPilotBackend("${modelBasePath}_mtk.pte")

        // GPU delegate — broad support, good performance
        GpuBackend.isSupported() && fileExists("${modelBasePath}_gpu.tflite") ->
            GpuBackend("${modelBasePath}_gpu.tflite")

        // XNNPACK CPU — always works
        else -> XnnpackBackend("${modelBasePath}_xnnpack.pte")
    }
}
```

### Shipping Strategy

| Approach | Binary Size | Performance | Compatibility |
|----------|------------|-------------|---------------|
| XNNPACK only | Small (~5MB runtime) | Good (CPU) | 100% devices |
| XNNPACK + GPU | Medium (~8MB) | Better | ~80% devices |
| XNNPACK + QNN | Medium (~10MB) | Best on Snapdragon | Snapdragon + fallback |
| All backends | Large (~20MB+) | Adaptive | Maximum coverage |

**Recommendation**: Ship XNNPACK `.pte` as the default. Add QNN `.pte` for Snapdragon flagships if you have the binary size budget. Download NPU-specific models on-demand rather than bundling all variants.

### Test Matrix

Always test on:
- **Flagship**: Snapdragon 8 Gen 3/4 (QNN/NPU path)
- **Mid-range**: Snapdragon 7 Gen 2/3 or Dimensity 7000 (GPU/CPU path)
- **Budget**: Older Snapdragon 6xx or MediaTek Helio (CPU-only path)
- **Pixel**: Tensor G3/G4 (LiteRT path)

---

## Profiling

### Snapdragon Profiler

Qualcomm's profiler for tracing NPU/GPU/CPU activity:
- Trace HTP utilization during inference
- Monitor thermal throttling
- Memory bandwidth and cache hit rates
- Power consumption breakdown by compute unit

### Android GPU Inspector (AGI)

Google's GPU profiling tool:
- GPU delegate performance counters
- Shader execution time
- Memory allocation patterns

### ExecuTorch Built-in Profiling

```python
# Enable profiling during export
from executorch.exir import ExecutorchBackendConfig

backend_config = ExecutorchBackendConfig(
    extract_delegate_segments=True,  # Enable per-delegate profiling
)
```

At runtime, use `ETDumpGen` for op-level timing data. Parse the dump with ExecuTorch's analysis tools.

### Systrace / Perfetto

```bash
# Capture a system trace with model inference
adb shell perfetto -o /data/misc/perfetto-traces/trace.perfetto-trace \
    -t 10s sched freq idle am wm gfx view binder_driver hal \
    dalvik camera input res
```

Look for: inference duration, thread scheduling, GPU/NPU activity, memory pressure events.

### Key Metrics to Track

| Metric | Tool | What to Look For |
|--------|------|-----------------|
| Inference latency | Custom timing | p50 < target, p95 < 2x target |
| NPU utilization | Snapdragon Profiler | >80% during inference |
| Thermal throttling | adb shell dumpsys thermalservice | Sustained performance drop |
| Memory (RSS) | adb shell dumpsys meminfo | Peak < 50% device RAM |
| Battery drain | adb shell dumpsys batterystats | mAh per inference session |

---

## Common Pitfalls

1. **Testing only on flagship**: Your QNN-optimized model runs great on S24 Ultra but crashes on a Pixel 7a. Always test the CPU fallback path.

2. **Ignoring thermal throttling**: Phone hits 60fps for 10 seconds then drops to 15fps. Test sustained inference over 5+ minutes. Use thermal monitoring to detect throttling.

3. **Bundling all model variants**: Three `.pte` files at 500MB each = 1.5GB download. Use on-demand model downloads for non-default backends.

4. **QNN compilation target mismatch**: Model compiled for SM8650 won't run on SM8550. Either compile per-target or use XNNPACK fallback.

5. **JNI memory leaks**: Forgetting to call destroy/release on native objects. Always use try-finally or implement Closeable.

6. **Wrong quantization for backend**: QNN HTP requires INT8 QDQ format. XNNPACK prefers symmetric INT8. MediaTek supports A16W4. Use the backend's quantizer, not generic quantization.

7. **NNAPI delegation**: Still shows up in tutorials but is deprecated. New code should use ExecuTorch backends or LiteRT delegates directly.

8. **Play Services dependency**: LiteRT via Play Services doesn't work on Huawei (no Google Play), Amazon Fire tablets, or sideloaded devices. Bundle the runtime if you need broad compatibility.
