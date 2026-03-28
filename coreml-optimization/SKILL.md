---
name: coreml-optimization
description: |
  Deep guide for CoreML and Apple Neural Engine (ANE) optimization on iOS/macOS.
  Use when converting models to CoreML, optimizing for ANE, using split einsum for attention,
  quantizing with coremltools (palettization, INT4, joint compression), building stateful models (KV cache),
  profiling with MLComputePlan, or using Apple Foundation Models (iOS 26).
  Covers LLMs, diffusion, TTS, ASR, vision, and embedding models.
---

# CoreML & Apple Neural Engine Optimization

The deep craft of getting AI models onto the Apple Neural Engine efficiently.

## ANE Architecture Mental Model

The ANE is fundamentally a **convolution engine**. It thinks in `[1, C, 1, S]` (batch, channels, 1, spatial). Everything maps to convolution internally.

**Hard limits**:
- Maximum 5D tensors
- 16,384 maximum per dimension
- ~32MB per tensor (larger tensors get rejected to CPU/GPU)
- Limited op set — significantly smaller than GPU

**Critical insight**: Reshape, transpose, and permute operations are "free" on CPU but **kill ANE performance**. They force the runtime to move computation off the ANE. If your model has many reshapes in hot paths, the ANE will not help.

**What runs well on ANE**: Convolutions, matrix multiplications (mapped to conv), element-wise ops, concatenation along channel dim, pooling.

**What falls back to CPU/GPU**: Complex reshapes, gather/scatter, most recurrent ops (LSTM/GRU), dynamic shapes, unsupported activations.

---

## Split Einsum

### What It Is

Standard attention computes `Q @ K^T → softmax → @ V` using the einsum pattern `bnqd,bnkd->bnqk`. This requires reshape/transpose operations that force computation off the ANE.

Split einsum reformulates attention to `bchq,bkhc->bkhq`, which maps directly to the ANE's native convolution operations. The data layout matches what the hardware expects — no reshapes needed.

### Where It Lives

Split einsum is **NOT a coremltools parameter**. It's an architecture-level transform from Apple's `ml-stable-diffusion` project.

```python
# ml-stable-diffusion/python_coreml_stable_diffusion/unet.py
class AttentionImplementation(Enum):
    ORIGINAL = "ORIGINAL"              # Standard attention (CPU/GPU)
    SPLIT_EINSUM = "SPLIT_EINSUM"      # ANE-friendly attention
    SPLIT_EINSUM_V2 = "SPLIT_EINSUM_V2"  # Optimized ANE attention (10-30% faster)
```

### Usage

```bash
# Via ml-stable-diffusion conversion script
python -m python_coreml_stable_diffusion.torch2coreml \
    --model-version stabilityai/stable-diffusion-2-1 \
    --attention-implementation SPLIT_EINSUM_V2 \
    --convert-unet \
    --bundle-resources-for-swift-cli \
    -o output/
```

### When to Apply

| Scenario | Use Split Einsum? | Variant |
|----------|-------------------|---------|
| SD 1.5 / 2.x UNet | Yes | `SPLIT_EINSUM_V2` |
| Custom transformer with Q/K/V attention | Yes | `SPLIT_EINSUM_V2` |
| SDXL UNet | **NO** | Compile time explodes (hours → days) |
| Small models where CPU is fine | No | Overhead not worth it |
| Non-attention models (CNNs, RNNs) | N/A | No attention to split |

### Implementing in Custom Models

To apply split einsum to your own transformer, restructure the attention computation:

```python
# BEFORE (standard — bad for ANE):
# Q: [B, heads, seq_q, dim]  K: [B, heads, seq_k, dim]  V: [B, heads, seq_k, dim]
attn_weights = torch.einsum("bnqd,bnkd->bnqk", Q, K) / math.sqrt(dim)
attn_weights = torch.softmax(attn_weights, dim=-1)
output = torch.einsum("bnqk,bnkd->bnqd", attn_weights, V)

# AFTER (split einsum — ANE-friendly):
# Reshape to channel-last: Q: [B, dim, heads, seq_q]  K: [B, dim, heads, seq_k]
Q = Q.permute(0, 3, 1, 2)  # [B, dim, heads, seq_q]
K = K.permute(0, 3, 1, 2)  # [B, dim, heads, seq_k]
V = V.permute(0, 3, 1, 2)  # [B, dim, heads, seq_k]

# Chunk along head dim to stay within ANE limits
chunks_q = Q.split(1, dim=2)  # List of [B, dim, 1, seq_q]
chunks_k = K.split(1, dim=2)
chunks_v = V.split(1, dim=2)

attn_out = []
for q, k, v in zip(chunks_q, chunks_k, chunks_v):
    # These are now 4D conv-like ops — native ANE
    attn = torch.einsum("bchq,bchk->bqk", q, k) / math.sqrt(dim)
    attn = torch.softmax(attn, dim=-1)
    out = torch.einsum("bqk,bchk->bchq", attn, v)
    attn_out.append(out)

output = torch.cat(attn_out, dim=2)  # [B, dim, heads, seq_q]
output = output.permute(0, 2, 3, 1)   # Back to [B, heads, seq_q, dim]
```

**V2 improvement**: Processes multiple heads simultaneously instead of chunking, giving 10-30% speedup on mobile ANE. Only available through `ml-stable-diffusion`'s conversion pipeline.

---

## Compute Unit Strategy

```swift
let config = MLModelConfiguration()
config.computeUnits = .all  // Default — let CoreML runtime decide per-op
```

### Decision Tree

| Compute Units | When to Use | Typical Models |
|---------------|-------------|----------------|
| `.all` | Default — CoreML picks optimal per-op | Most models, start here |
| `.cpuAndNeuralEngine` | Force ANE path, skip GPU | Image gen UNet, vision CNNs |
| `.cpuAndGPU` | When ANE has unsupported ops or model exceeds ANE limits | Large vocab LLMs, complex activations |
| `.cpuOnly` | Simulator, debugging, or precision-critical paths | LSTM state, STFT/iSTFT, debugging |

### Per-Model-Type Recommendations

| Model Type | Recommended | Notes |
|-----------|-------------|-------|
| LLM (prefill) | `.cpuAndNeuralEngine` | Bulk matmul maps well to ANE |
| LLM (decode) | `.cpuAndGPU` | Sequential generation, GPU better for small batches |
| Diffusion UNet | `.cpuAndNeuralEngine` | With split einsum attention |
| Diffusion VAE | `.cpuAndGPU` | GroupNorm, complex activations |
| Diffusion Text Encoder | `.all` | Small model, let runtime decide |
| TTS Encoder | `.all` | Usually small enough for ANE |
| TTS Decoder | `.cpuOnly` or `.all` | LSTM/GRU often CPU-only |
| ASR (Whisper) | `.all` | Encoder on ANE, decoder mixed |
| Vision CNN | `.cpuAndNeuralEngine` | Conv-heavy, ANE's strength |
| Depth Estimation | `.all` | Depends on architecture |

---

## Quantization for ANE

### 4-Bit Palettization (Best for ANE)

Clusters weights into 2^n centroids using k-means. The ANE has hardware support for palettized lookups.

```python
import coremltools as ct
import coremltools.optimize.coreml as cto

# Load unquantized model
model = ct.models.MLModel("model.mlpackage")

# Configure 4-bit palettization
config = cto.OptimizationConfig(
    global_config=cto.OpPalettizerConfig(
        mode="kmeans",                     # kmeans, uniform, unique, or custom
        nbits=4,                           # {1, 2, 3, 4, 6, 8}
        granularity="per_grouped_channel", # per_tensor or per_grouped_channel
        group_size=16,                     # Channel group size (smaller = better quality, larger model)
        enable_per_channel_scale=True,     # Scale factor per channel (improves quality)
    )
)

# Apply palettization
model = cto.palettize_weights(model, config)
model.save("model_palettized.mlpackage")
```

**OpPalettizerConfig parameters**:
- `mode`: `"kmeans"` (best quality), `"uniform"` (fastest), `"unique"` (for weights with few unique values)
- `nbits`: 4 is the sweet spot. 2-bit works for non-critical layers. 6/8-bit for sensitive layers.
- `granularity`: `"per_grouped_channel"` almost always better than `"per_tensor"`
- `group_size`: 16 (default), lower = better quality + larger overhead
- `enable_per_channel_scale`: Always `True` — minimal size cost, significant quality improvement
- `weight_threshold`: Minimum tensor size to quantize (skip tiny tensors)

### INT4 Per-Block (Best for GPU)

Linear quantization with block-wise scaling. Better for GPU compute, less ideal for ANE.

```python
config = cto.OptimizationConfig(
    global_config=cto.OpLinearQuantizerConfig(
        mode="linear_symmetric",   # linear_symmetric or linear (asymmetric)
        dtype="int4",              # int4, uint4, int8, uint8
        granularity="per_block",   # per_tensor, per_channel, per_block
        block_size=32,             # Block size for per_block granularity
    )
)
model = cto.linear_quantize_weights(model, config)
```

### Joint Compression (A17 Pro / M4 and newer)

The big win on modern Apple Silicon. Combines palettization with linear quantization for A8W4 — the LUT entries themselves are INT8, enabling the fast int8×int8 ANE compute path.

```python
# Step 1: Palettize
palette_config = cto.OptimizationConfig(
    global_config=cto.OpPalettizerConfig(
        mode="kmeans", nbits=4, granularity="per_grouped_channel",
        group_size=16, enable_per_channel_scale=True,
    )
)
palettized = cto.palettize_weights(model, palette_config)

# Step 2: Linear quantize the palettized model with joint compression
# IMPORTANT: joint_compression=True requires per_tensor granularity
quant_config = cto.OptimizationConfig(
    global_config=cto.OpLinearQuantizerConfig(
        mode="linear_symmetric", dtype="int8", granularity="per_tensor",
    )
)
compressed = cto.linear_quantize_weights(palettized, quant_config, joint_compression=True)
compressed.save("model_a8w4.mlpackage")
```

**Result**: 4-bit effective weight precision with INT8 LUT entries → triggers the fast int8×int8 ANE datapath on A17 Pro/M4+. Roughly 2x throughput vs standard 4-bit.

### Critical Rules

1. **Palettize `.mlpackage` BEFORE compiling to `.mlmodelc`** — the compiler needs the palettization metadata
2. **Use `compute_units=CPU_ONLY` when saving palettized models** — ANE can hang during `.save()` with palettized weights
3. **Always keep the `.mlpackage`** — you'll need it when macOS updates break your `.mlmodelc`
4. **Test quality after quantization** — run your eval suite, don't assume quality is fine

---

## Stateful Models (iOS 18+)

Managed state eliminates explicit KV cache input/output, letting the CoreML runtime handle memory.

### PyTorch Side

```python
class MyLLM(torch.nn.Module):
    def __init__(self, num_heads, max_seq, head_dim):
        super().__init__()
        # Register KV cache as buffer — becomes CoreML state
        self.register_buffer("k_cache", torch.zeros(1, num_heads, max_seq, head_dim))
        self.register_buffer("v_cache", torch.zeros(1, num_heads, max_seq, head_dim))

    def forward(self, x, position):
        # Update cache at position
        k, v = self.compute_kv(x)
        self.k_cache[:, :, position:position+1, :] = k
        self.v_cache[:, :, position:position+1, :] = v
        # Attend over cached keys/values
        return self.attend(x, self.k_cache[:, :, :position+1, :],
                          self.v_cache[:, :, :position+1, :])
```

### Conversion

```python
import coremltools as ct

traced = torch.jit.trace(model.eval(), example_inputs)

# Define state types matching register_buffer names
k_state = ct.StateType(
    wrapped_type=ct.TensorType(shape=(1, num_heads, max_seq, head_dim)),
    name="k_cache",
)
v_state = ct.StateType(
    wrapped_type=ct.TensorType(shape=(1, num_heads, max_seq, head_dim)),
    name="v_cache",
)

mlmodel = ct.convert(
    traced,
    states=[k_state, v_state],
    minimum_deployment_target=ct.target.iOS18,  # Required for stateful models
)
mlmodel.save("llm_stateful.mlpackage")
```

### Swift Runtime

```swift
import CoreML

let config = MLModelConfiguration()
config.computeUnits = .all

let model = try MLModel(contentsOf: modelURL, configuration: config)
let state = model.makeState()  // Allocates KV cache

// Decode loop — state persists across calls
for position in 0..<maxTokens {
    let input = try MLDictionaryFeatureProvider(dictionary: [
        "input_ids": MLMultiArray(shape: [1, 1], dataType: .int32),
        "position": MLMultiArray(shape: [1], dataType: .int32),
    ])
    let result = try model.prediction(from: input, using: state)
    let logits = result.featureValue(for: "logits")!.multiArrayValue!
    // Sample next token from logits...
}
```

---

## Conversion Pipeline

### Option A: torch.jit.trace (Stable, Full Op Coverage)

```python
import coremltools as ct
import torch

model.eval()
example_input = torch.randn(1, 3, 224, 224)
traced = torch.jit.trace(model, example_input)

mlmodel = ct.convert(
    traced,
    inputs=[ct.TensorType(name="image", shape=(1, 3, 224, 224))],
    outputs=[ct.TensorType(name="logits")],
    minimum_deployment_target=ct.target.iOS17,
    compute_precision=ct.precision.FLOAT16,    # FLOAT16 or FLOAT32
    compute_units=ct.ComputeUnit.ALL,
)
mlmodel.save("model.mlpackage")
```

### Option B: torch.export (Newer, Auto-Infers Shapes)

```python
from torch.export import export

exported = export(model.eval(), (example_input,))
mlmodel = ct.convert(
    exported,
    # No inputs/outputs needed — auto-inferred from export signature
    minimum_deployment_target=ct.target.iOS17,
    compute_precision=ct.precision.FLOAT16,
)
```

**torch.export caveats**: Op coverage is still expanding — not all PyTorch ops are supported. Falls back to `torch.jit.trace` when unsupported ops hit. Supports `torch.export.Dim()` for dynamic shapes. coremltools 8.x (stable) has less coverage than 9.0b1 (beta).

### Flexible Shapes

```python
# Fixed shape (ANE-friendly, faster):
ct.TensorType(name="input", shape=(1, 3, 224, 224))

# Flexible shape (versatile, may prevent ANE):
ct.TensorType(name="input", shape=ct.Shape(
    shape=(1, 3, ct.RangeDim(lower_bound=128, upper_bound=512, default=224),
                 ct.RangeDim(lower_bound=128, upper_bound=512, default=224))
))

# Enumerated shapes (ANE-friendly, multiple fixed sizes):
ct.TensorType(name="input", shape=ct.EnumeratedShapes(
    shapes=[(1, 3, 224, 224), (1, 3, 384, 384), (1, 3, 512, 512)]
))
```

**Rule**: Use fixed shapes for ANE. Use `EnumeratedShapes` if you need a few sizes. Use `RangeDim` only for GPU/CPU targets.

### Compilation

```bash
# Compile .mlpackage → .mlmodelc (deployed in app bundle)
xcrun coremlcompiler compile model.mlpackage output_dir/

# The .mlmodelc is optimized for the compilation host's macOS version.
# Keep .mlpackage source — recompile when targeting new OS versions.
```

### Deployment Target Reference

| Target | Key Features |
|--------|-------------|
| `ct.target.iOS16` | mlprogram format, basic ANE ops |
| `ct.target.iOS17` | MLComputePlan, expanded op set |
| `ct.target.iOS18` | Stateful models (KV cache), new quantization ops |

---

## LLM-Specific: Disaggregated Inference

Split prefill and decode across different compute units for optimal throughput AND power efficiency.

### Pattern
- **Prefill** (processing input prompt): ANE — bulk matrix multiply, ANE's strength
- **Decode** (generating tokens): GPU — sequential single-token generation, GPU handles better

### ANEMLL Framework

Open-source ANE LLM framework supporting Llama 3.2, Qwen 3, Gemma 3, DeepSeek R1, and others — check the [ANEMLL repo](https://github.com/Anemll/Anemll) for the current model list.

```bash
# Convert model
./anemll/utils/convert_model.sh \
    --model meta-llama/Llama-3.2-1B \
    --output ./models/llama-1b/ \
    --context 4096 \
    --batch 64 \
    --chunk 1 \
    --lut2 6 \       # LUT quantization bits for layer group 2
    --lut3 6          # LUT quantization bits for layer group 3

# Requirements: macOS Sequoia, Apple Silicon, Python 3.9-3.11
```

**Benchmarks**: 47-62 tok/s on 1B models, ~10x power reduction vs GPU-only inference (ANE ~2W vs GPU ~20W). 500MB memory for a heavily quantized (LUT-6) 8B model vs ~8GB at FP16 — the savings come from aggressive quantization, not just runtime efficiency.

---

## Diffusion-Specific

### UNet / Transformer
- Apply split einsum V2 for attention blocks — the single biggest ANE win
- 4-bit palettization for weights
- Fixed input shapes (e.g., latent: `[1, 4, 64, 64]`, timestep: `[1]`, encoder_hidden_states: `[1, 77, 768]`)
- `computeUnits = .cpuAndNeuralEngine`

### VAE
- GroupNorm and SiLU often fall back to CPU/GPU
- Keep at `.cpuAndGPU` or `.all`
- VAE decoder sometimes needs FP32 for color accuracy — test carefully

### Memory
- Peak during UNet denoising step: ~300-500MB for SD 1.5, ~1-2GB for SDXL
- Run one component at a time to reduce peak: load text encoder → unload → load UNet → unload → load VAE

---

## Audio Models (TTS / ASR)

### LSTM / GRU
- Recurrent ops have limited ANE support — often run CPU-only
- Use `computeUnits = .cpuOnly` for recurrent models, or `.all` and let runtime decide

### Streaming
- Fixed chunk sizes for streaming inference (e.g., 512 samples = 32ms at 16kHz)
- Manage recurrent state explicitly via stateful models (iOS 18+) or manual I/O

### Signal Processing
- STFT/iSTFT: Use Accelerate framework (vDSP) directly in Swift — faster and more accurate than CoreML
- Don't convert signal processing to CoreML — it's not what the ANE is good at

---

## Apple Foundation Models (iOS 26)

Free, on-device 3B language model built into iOS 26+.

### Basic Generation

```swift
import FoundationModels

let session = LanguageModelSession()
let response = try await session.respond(to: "Describe this location")
print(response)

// Streaming
for try await partial in session.streamResponse(to: "Tell me a story") {
    print(partial, terminator: "")
}
```

### Structured Output

```swift
@Generable
struct SpiritProfile {
    @Guide(description: "The spirit's name")
    var name: String

    @Guide(description: "Danger level from 1 to 10")
    var dangerLevel: Int

    @Guide(description: "Brief backstory")
    var backstory: String
}

let session = LanguageModelSession()
let profile = try await session.respond(
    to: "Create a ghost that haunts a Victorian mansion",
    generating: SpiritProfile.self
)
// profile.name, profile.dangerLevel, profile.backstory — all typed
```

### Tool Calling

```swift
struct LookupTool: Tool {
    let name = "lookup"
    let description = "Look up information in the database"

    @Generable
    struct Arguments {
        @Guide(description: "The search query")
        var query: String
    }

    func call(arguments: Arguments) async throws -> String {
        return "Result for: \(arguments.query)"
    }
}

let session = LanguageModelSession(tools: [LookupTool()])
let response = try await session.respond(to: "Look up haunted locations in Salem")
```

### When to Use vs Custom Models

| Use Apple Foundation Models | Use Custom Models |
|---------------------------|-------------------|
| General text tasks | Domain-specific (medical, legal, code) |
| Quick prototyping | Fine-tuned behavior |
| No model management wanted | Specific architecture needed |
| English text (primarily) | Multilingual requirements |
| iOS 26+ only target | Broader OS support needed |

---

## Profiling & Debugging

### MLComputePlan (iOS 17+)

Check which compute unit each operation is assigned to:

```swift
import CoreML

let config = MLModelConfiguration()
config.computeUnits = .all

let plan = try await MLComputePlan.load(contentsOf: modelURL, configuration: config)

if let program = plan.modelStructure.program {
    for op in program.functions["main"]!.block.operations {
        let usage = plan.computeDeviceUsage(for: op)
        let cost = plan.estimatedCost(of: op)

        let device = usage?.preferredComputeDevice  // .cpu, .gpu, or .neuralEngine
        print("Op: \(op.operatorName) → \(device) (cost: \(cost?.weight ?? 0))")
    }
}
```

**What to look for**: Ops falling back to CPU when you expected ANE. Reshape/transpose ops that break ANE execution chains.

### Instruments

1. Open Instruments → CoreML template
2. Run your app with model inference
3. Look for: compute unit switches (expensive), memory spikes, ANE utilization gaps

### Memory Profiling

```swift
import mach

func logMemory(label: String) {
    var info = mach_task_basic_info()
    var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
    withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
            task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
        }
    }
    let mb = Double(info.resident_size) / 1_048_576
    print("[\(label)] Memory: \(String(format: "%.1f", mb)) MB")
}
```

---

## Common Pitfalls

1. **macOS upgrades break `.mlmodelc`**: Pre-compiled models use MIL text format tied to the compilation host. Always keep `.mlpackage` source and recompile with `xcrun coremlcompiler compile` after OS updates.

2. **Large vocab projections rejected by ANE**: Embedding/projection layers with >16K channels (common in LLMs with 32K+ vocab) exceed ANE dimension limits. Split into chunks or keep on GPU.

3. **Float16 accumulation errors**: Long sequences in LLMs accumulate FP16 rounding errors. Critical for generation quality. Consider FP32 for the final logits projection layer.

4. **coremltools version pinning**: Breaking changes between major versions. Pin your version. Stable is 8.x series; 9.0 is beta (9.0b1) and requires PyTorch 2.7. Use `pip install coremltools` for stable, `pip install coremltools==9.0b1` for beta features.

5. **torch.export op coverage**: Not all PyTorch ops are supported via torch.export path (coverage expanding with each release). Always have `torch.jit.trace` as fallback.

6. **Simulator uses CPU only**: `.cpuAndNeuralEngine` works on device but falls back to CPU on simulator. Don't benchmark on simulator.

7. **Fixed vs flexible shapes**: Flexible shapes (`RangeDim`) often prevent ANE execution. Use fixed shapes or `EnumeratedShapes` when targeting ANE.

8. **Model too large for single ANE program**: ANE has a maximum program size. Very large models need to be split into chunks. ANEMLL handles this automatically for LLMs.
