# LiteRT, ONNX Runtime Mobile, Gemini Nano, LiteRT-LM

## Contents

- [LiteRT (TFLite successor)](#litert-tflite-successor)
- [ONNX Runtime Mobile](#onnx-runtime-mobile)
- [Gemini Nano (ML Kit GenAI)](#gemini-nano-ml-kit-genai)
- [LiteRT-LM (replaces MediaPipe LLM Inference)](#litert-lm-replaces-mediapipe-llm-inference)

## LiteRT (TFLite successor)

Google's lightweight runtime, the successor to TensorFlow Lite. Good for Pixel devices
and broad compatibility.

### PyTorch to LiteRT

```python
import litert_torch  # pip install litert-torch (formerly ai-edge-torch)

model.eval()
edge_model = litert_torch.convert(model, sample_inputs)
edge_model.export("model.tflite")
```

### GPU delegate with CPU fallback (Interpreter API, LiteRT 1.x)

In LiteRT 2.x the `Interpreter` API is CPU-only and kept for backward compatibility; GPU
through `Interpreter` + `GpuDelegate` needs the 1.4.x artifacts.

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
    // Standalone, Interpreter + GpuDelegate (bundled in the APK)
    implementation("com.google.ai.edge.litert:litert:1.4.2")
    implementation("com.google.ai.edge.litert:litert-gpu:1.4.2")
    implementation("com.google.ai.edge.litert:litert-gpu-api:1.4.2")

    // OR standalone LiteRT 2.x with the CompiledModel API (see below)
    // implementation("com.google.ai.edge.litert:litert:2.3.2")
    // implementation("com.google.ai.edge.litert:litert-gpu:2.3.2")

    // OR Play Services (smaller APK, Google-managed runtime)
    implementation("com.google.android.gms:play-services-tflite-java:16.5.0")
    implementation("com.google.android.gms:play-services-tflite-gpu:16.5.0")
}
```

### CompiledModel API (LiteRT 2.x)

The current API for GPU and NPU acceleration:

```kotlin
import com.google.ai.edge.litert.Accelerator
import com.google.ai.edge.litert.CompiledModel

val model = CompiledModel.create(modelPath, CompiledModel.Options(Accelerator.GPU))
val inputBuffers = model.createInputBuffers()
val outputBuffers = model.createOutputBuffers()
inputBuffers[0].writeFloat(inputData)
model.run(inputBuffers, outputBuffers)
val output = outputBuffers[0].readFloat()
```

Create with `Accelerator.CPU` when GPU creation fails, so the fallback stays in one API.

### Play Services variant

```kotlin
import org.tensorflow.lite.InterpreterApi
import org.tensorflow.lite.TfLiteRuntime
import org.tensorflow.lite.gpu.GpuDelegateFactory

val options = InterpreterApi.Options()
    .setRuntime(TfLiteRuntime.FROM_SYSTEM_ONLY)
    .addDelegateFactory(GpuDelegateFactory())

val interpreter = InterpreterApi.create(modelBuffer, options)
```

Play Services gives a smaller APK because Google Play provides the runtime. It requires
Google Play Services, so it fails on Huawei, Amazon Fire tablets and sideloaded devices;
bundle the standalone runtime when those matter.

## ONNX Runtime Mobile

Cross-platform runtime with multiple execution providers.

```kotlin
dependencies {
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.32.0")
    // QNN EP build for Snapdragon NPUs: com.microsoft.onnxruntime:onnxruntime-android-qnn
}
```

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

### QNN execution provider (Qualcomm NPU)

Python, for model optimization and testing:

```python
import onnxruntime as ort

session = ort.InferenceSession(
    "model.onnx",
    providers=["QNNExecutionProvider"],
    provider_options=[{
        "backend_type": "htp",                # Hexagon NPU (or backend_path="libQnnHtp.so")
        "htp_performance_mode": "burst",      # burst, sustained_high_performance, balanced, ...
        "soc_model": "57",                    # QNN SoC number, not a name: SM8650 = 57
    }],
)
output = session.run(None, {"input": input_array})
```

### Context binary caching

Pre-compile the model once on the host so on-device loads skip graph compilation:

```python
options = ort.SessionOptions()
options.add_session_config_entry("ep.context_enable", "1")
options.add_session_config_entry("ep.context_embed_mode", "1")  # embed the QNN binary
ort.InferenceSession("model.onnx", options, providers=["QNNExecutionProvider"],
                     provider_options=[{"backend_type": "htp", "soc_model": "57"}])
# Session creation writes model_ctx.onnx next to the input (ep.context_file_path overrides).
# Ship and load model_ctx.onnx; without embed mode, keep the generated .bin beside it.
```

## Gemini Nano (ML Kit GenAI)

Gemini Nano runs inside the AICore system app and is reached through ML Kit GenAI: task
APIs (summarization, proofreading, rewriting, image description, speech) and the Prompt
API for free-form prompts. Artifacts are in beta, so check the
[ML Kit GenAI docs](https://developers.google.com/ml-kit/genai) for current versions.

```kotlin
// build.gradle.kts
dependencies {
    implementation("com.google.mlkit:genai-prompt:1.0.0-beta5")
}
```

```kotlin
val generativeModel = Generation.getClient()

when (generativeModel.checkStatus()) {
    FeatureStatus.AVAILABLE -> Unit
    FeatureStatus.DOWNLOADABLE -> generativeModel.download().collect { /* progress */ }
    FeatureStatus.DOWNLOADING -> Unit  // wait
    FeatureStatus.UNAVAILABLE -> return  // unsupported device: use your own model
}

val response = generativeModel.generateContent("Summarize this text: ...")

generativeModel.generateContentStream("Tell me about...").collect { chunk ->
    val partialText = chunk.candidates[0].text  // update UI incrementally
}
```

| Constraint | Value |
|-----------|-------|
| Input | Under ~4,000 tokens; check with `countTokens` |
| Supported devices | A published per-model list of recent Pixel, Samsung and other flagships; always gate on `checkStatus()` |
| Device requirements | API 26+, AICore installed, locked bootloader |
| Fine-tuning | Not available |
| Status | Beta; the API surface is still changing |

Use it for summarization, proofreading, rewriting and short prompts on supported devices.
Skip it for custom models, long generation, broad device support or guaranteed
availability.

## LiteRT-LM (replaces MediaPipe LLM Inference)

The MediaPipe LLM Inference API (`com.google.mediapipe:tasks-genai`) is deprecated on
Android and iOS in favor of LiteRT-LM. Do not start new integrations on it; existing
`.task` models keep working there while you migrate. LiteRT-LM loads `.litertlm` models
(prebuilt ones are in the LiteRT Community on Hugging Face) on CPU, GPU or NPU.

```kotlin
// build.gradle.kts
dependencies {
    implementation("com.google.ai.edge.litertlm:litertlm-android:0.19.1")
}
```

```kotlin
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig

val engine = Engine(EngineConfig(modelPath = modelPath, backend = Backend.GPU()))
engine.initialize()
engine.createConversation().use { conversation ->
    // Synchronous
    val reply = conversation.sendMessage("What is the capital of France?")

    // Streaming (Flow)
    conversation.sendMessageAsync("Tell me a story").collect { updateUI(it.toString()) }
}
engine.close()
```

Use it for Gemma-class LLMs with minimal integration work. Pick ExecuTorch instead for
non-supported architectures, a custom quantization flow, or per-SoC QNN tuning.
