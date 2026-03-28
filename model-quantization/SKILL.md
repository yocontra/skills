---
name: model-quantization
description: |
  Cross-platform model quantization, format conversion, and mobile architecture selection.
  Use when quantizing models (AWQ, GPTQ, GGUF), converting between formats (HuggingFace, ONNX, CoreML, ExecuTorch),
  choosing mobile-optimized model architectures, or estimating memory/performance on phones.
  Covers LLMs, diffusion, TTS, ASR, vision, and embedding models.
---

# Model Quantization & Mobile Optimization

The craft of making models small and fast enough for phones without destroying quality.

## Quantization Techniques Overview

| Method | Bits | Calibration | Quant Speed | Inference | Quality | Best For |
|--------|------|-------------|-------------|-----------|---------|----------|
| AWQ | 4 | Yes (small set) | Fast | Fast | Best 4-bit (~+11% ppl) | Mobile LLMs |
| GPTQ | 4 | Yes (128 samples) | Slow | Fast | Good (~+12% ppl) | GPU servers, legacy |
| GGUF Q4_K_M | 4.83 | No | N/A | Very fast | Excellent (+0.05 ppl) | llama.cpp mobile |
| GGUF IQ4_XS | 4.25 | Importance matrix | N/A | Very fast | Great | Smallest good 4-bit |
| SmoothQuant | 8 | Yes | Fast | Fastest | Near-lossless | When 8-bit is enough |
| INT8 dynamic | 8 | No | N/A | Fast | 0.04% drop | Easy wins |

**Decision**: Use AWQ for models going to ExecuTorch/CoreML pipelines. Use GGUF for llama.cpp deployments. Use INT8 when quality is paramount and memory allows.

---

## AWQ (Recommended for Mobile LLMs)

Activation-aware Weight Quantization — preserves salient weights based on activation magnitudes.

```python
from awq import AutoAWQForCausalLM
from transformers import AutoTokenizer

model_path = "meta-llama/Llama-3.1-8B"
model = AutoAWQForCausalLM.from_pretrained(model_path)
tokenizer = AutoTokenizer.from_pretrained(model_path)

model.quantize(
    tokenizer,
    quant_config={
        "zero_point": True,       # Asymmetric quantization (better quality)
        "q_group_size": 128,      # Group size — 128 is standard, 32 for better quality
        "w_bit": 4,               # 4-bit weights
        "version": "GEMM",        # GEMM for batch=1 (mobile), GEMV for larger batch
    },
)
model.save_quantized("llama-3.1-8b-awq")
tokenizer.save_pretrained("llama-3.1-8b-awq")
```

**Why AWQ over GPTQ**:
- Less accuracy degradation — AWQ preserves >99% of FP16 task accuracy on most benchmarks
- Faster quantization (minutes vs hours)
- Better generalization — AWQ preserves salient weights, GPTQ over-fits to calibration set
- GPTQ only wins for very large batch GPU inference (Marlin kernel at 741 tok/s)

**Key parameters**:
- `q_group_size`: 128 (standard), 64 (better quality, slightly larger), 32 (best quality)
- `version`: `"GEMM"` for single-sample inference (mobile), `"GEMV"` for batched
- `zero_point`: `True` for asymmetric (better), `False` for symmetric (faster)

---

## GPTQ

Post-training quantization using approximate second-order information (Hessian).

```python
from gptqmodel import GPTQModel, QuantizeConfig

config = QuantizeConfig(
    bits=4,
    group_size=128,
    desc_act=False,       # True: +0.05 ppl improvement, but slower + breaks some kernels
    damp_percent=0.01,    # Dampening for Hessian inverse (higher = more stable, lower quality)
)
model = GPTQModel.load("meta-llama/Llama-3.1-8B", config)
model.quantize(calibration_dataset)  # ~128 samples from target distribution
model.save("llama-3.1-8b-gptq")
```

**Note**: AutoGPTQ is deprecated. Use `gptqmodel` (GPTQModel) instead.

**`desc_act` tradeoff**: Descending activation order improves perplexity by ~0.05 but makes inference sequential (can't parallelize), breaks Marlin/ExLlama kernels. Use `False` for mobile.

---

## GGUF / llama.cpp Quantization

The standard for llama.cpp deployments. No calibration data needed for most types.

```bash
# Step 1: Convert HuggingFace → GGUF
python convert_hf_to_gguf.py /path/to/hf-model \
    --outtype f16 \
    --outfile model-f16.gguf

# Step 2: Quantize
llama-quantize model-f16.gguf model-q4km.gguf Q4_K_M

# With importance matrix (better quality for IQ types):
llama-imatrix -m model-f16.gguf -f calibration.txt -o imatrix.dat
llama-quantize --imatrix imatrix.dat model-f16.gguf model-iq4xs.gguf IQ4_XS
```

### Quant Type Reference

Benchmarked on Llama-3.1-8B (FP16 baseline perplexity = 6.14):

| Type | BPW | Size (8B) | Perplexity | Notes |
|------|-----|-----------|------------|-------|
| Q8_0 | 8.50 | 8.5 GB | 6.17 | Max quality, if you have the RAM |
| Q6_K | 6.57 | 6.6 GB | 6.18 | High quality, moderate savings |
| Q5_K_M | 5.69 | 5.7 GB | 6.17 | Great quality/size balance |
| **Q4_K_M** | **4.83** | **4.8 GB** | **6.19** | **Recommended for mobile** |
| Q4_K_S | 4.58 | 4.6 GB | 6.24 | Tighter memory budget |
| IQ4_XS | 4.25 | 4.3 GB | 6.26 | Best sub-4.5 BPW (needs imatrix) |
| Q3_K_M | 3.91 | 3.9 GB | 6.40 | Noticeable quality loss |
| Q2_K | 3.35 | 3.4 GB | 7.25 | Emergency — significant degradation |

**ARM NEON optimization**: Q4_K_M gets 24x decode speedup on Armv9 (SVE/SME) vs naive implementation.

**Choosing a type**: Start with Q4_K_M. If it doesn't fit, try IQ4_XS (needs importance matrix). If quality matters more than size, Q5_K_M. Never ship Q2_K unless absolutely necessary.

---

## ONNX Quantization

For ONNX Runtime Mobile deployments:

```python
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, quantize_static, QuantType, QuantFormat

# Dynamic quantization (no calibration data needed)
quantize_dynamic(
    "model.onnx",
    "model_int8.onnx",
    weight_type=QuantType.QInt8,
)

# Static quantization (better quality, needs calibration)
from onnxruntime.quantization import CalibrationDataReader

class MyCalibReader(CalibrationDataReader):
    def get_next(self):
        # Return dict of input_name -> numpy array
        ...

quantize_static(
    "model.onnx",
    "model_int8_static.onnx",
    calibration_data_reader=MyCalibReader(),
    quant_format=QuantFormat.QDQ,  # QDQ for NPU/GPU delegates
    per_channel=True,
)
```

**Optimization levels** (via optimum-cli):
```bash
# O1: basic (constant folding, redundant node removal)
# O2: extended (attention fusion, skip layer norm fusion)
# O3: layout optimization (NCHW→NHWC where beneficial)
# O4: all + quantization
optimum-cli export onnx --model meta-llama/Llama-3.1-8B ./output/ -O2
```

---

## Format Ecosystem & Conversion Paths

```
                    ┌──────────────┐
                    │  HuggingFace │
                    │ (safetensors)│
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │   ONNX   │ │   GGUF   │ │  PyTorch  │
        │ (.onnx)  │ │ (.gguf)  │ │ (traced)  │
        └────┬─────┘ └──────────┘ └──┬────┬───┘
             │                       │    │
        ┌────▼─────┐          ┌─────▼┐  ┌▼────────┐
        │  ONNX RT │          │CoreML│  │ExecuTorch│
        │ Mobile   │          │(.mlp)│  │  (.pte)  │
        └──────────┘          └──────┘  └──────────┘
```

### Recommended Paths

| Target | Best Path | Command |
|--------|-----------|---------|
| CoreML (.mlpackage) | PyTorch → coremltools | `ct.convert(traced_model, minimum_deployment_target=ct.target.iOS17)` |
| ExecuTorch (.pte) | PyTorch → torch.export → ExecuTorch | `to_edge_transform_and_lower(export(model, inputs), partitioner=[...])` |
| GGUF | HuggingFace → convert_hf_to_gguf → llama-quantize | `python convert_hf_to_gguf.py ... && llama-quantize ...` |
| ONNX Runtime Mobile | HuggingFace → optimum-cli | `optimum-cli export onnx --model ... ./output/` |
| LiteRT (.tflite) | PyTorch → litert_torch | `litert_torch.convert(model, inputs).export('model.tflite')` |

### Conversion Commands

```bash
# HuggingFace → ONNX
optimum-cli export onnx --model meta-llama/Llama-3.1-8B ./onnx-output/

# HuggingFace → GGUF
python convert_hf_to_gguf.py ./model-dir --outtype f16 --outfile model.gguf

# PyTorch → CoreML (requires coremltools: pip install coremltools)
python -c "
import coremltools as ct
import torch
traced = torch.jit.trace(model.eval(), example_input)
ct.convert(traced, minimum_deployment_target=ct.target.iOS17).save('model.mlpackage')
"

# PyTorch → ExecuTorch
python -c "
from torch.export import export
from executorch.exir import to_edge_transform_and_lower
from executorch.backends.xnnpack.partition.xnnpack_partitioner import XnnpackPartitioner
edge = to_edge_transform_and_lower(export(model, inputs), partitioner=[XnnpackPartitioner()])
edge.to_executorch().write_to_file(open('model.pte', 'wb'))
"

# ONNX → CoreML (legacy path — prefer direct PyTorch → CoreML)
python -c "
import coremltools as ct
ct.converters.convert('model.onnx', minimum_deployment_target=ct.target.iOS17).save('model.mlpackage')
"

# Compile CoreML .mlpackage → .mlmodelc
xcrun coremlcompiler compile model.mlpackage output_dir/
```

---

## Mobile-Optimized Model Architectures

### LLMs

| Model | Params | Mobile Speed | Quality | Notes |
|-------|--------|-------------|---------|-------|
| SmolLM2 | 135M / 360M / 1.7B | 200+ tok/s | Good for size | Best tiny LLM family |
| MobileLLM | 125M / 350M | 120 tok/s | Decent | Meta's mobile-specific architecture |
| Qwen 3 | 0.6B / 1.7B / 4B | 100+ tok/s (0.6B) | Good–Excellent | Strong multilingual |
| Gemma 3 | 1B / 4B | 47-62 tok/s (1B ANE) | Strong | Best 1B quality, Google |
| TinyLlama | 1.1B | 80 tok/s | Good | Chat-capable, well-tested |
| Llama 3.2 | 1B / 3B | 30-50 tok/s | Excellent | Best quality/size ratio |
| Phi-3.5 Mini | 3.8B | 20-30 tok/s | Excellent | Microsoft, strong reasoning |

**Pick by memory budget**: <2GB → SmolLM2 360M or Qwen 0.6B. 2-4GB → Gemma/Llama 1B. 4-6GB → Llama 3B or Phi-3.5 Mini. Don't try 7B+ on phones unless 8GB+ RAM.

### Diffusion

| Model | Params | Steps | Phone Speed | Quality | Notes |
|-------|--------|-------|-------------|---------|-------|
| BK-SDM-Tiny | 0.50B | 25 | ~4s (iPhone 14) | OK | Smallest SD variant |
| SD-Turbo | 0.86B | 1-4 | ~2s | Good | Distilled SD 2.1 |
| SDXL-Turbo | 2.6B | 1-4 | ~6s | Excellent | Needs 6GB+ RAM |
| LCM-LoRA + SD 1.5 | 0.86B + 100MB | 2-4 | ~1.5s | Good | Drop-in adapter |
| EdgeFusion | ~0.5B | 2 | <1s (NPU) | Good | Latest, NPU-optimized |

**Pick by quality target**: Quick previews → EdgeFusion or SD-Turbo. Good quality → LCM-LoRA + SD 1.5. Best quality → SDXL-Turbo (if RAM allows).

### TTS / ASR

| Model | Type | Size | Latency | Quality | Notes |
|-------|------|------|---------|---------|-------|
| Kokoro | TTS | ~80MB | <500ms | Excellent | Best small TTS |
| Piper | TTS | 15-60MB | <200ms | Good | ONNX, many voices |
| WhisperKit tiny | ASR | ~40MB | 460ms | 2.2% WER | Apple-optimized |
| Whisper small | ASR | ~240MB | ~2s | 1.8% WER | Good balance |
| Whisper large-v3-turbo | ASR | ~800MB | ~4s | 1.3% WER | Best quality |
| Silero VAD | VAD | ~2MB | <10ms | Excellent | Voice activity only |

### Vision

| Model | Type | Size | Latency | Notes |
|-------|------|------|---------|-------|
| MobileNetV3 | Classification | ~5MB | <10ms | Standard mobile vision |
| EfficientNet-Lite | Classification | 5-25MB | 10-30ms | Better accuracy |
| YOLOv8n | Detection | ~6MB | ~15ms | Real-time detection |
| MiDaS small | Depth | ~25MB | ~50ms | Monocular depth |
| SAM-tiny | Segmentation | ~40MB | ~100ms | Segment Anything, mobile |

---

## Memory Estimation

### Weight Memory Formula

```
Weight memory = parameters × bytes_per_param

  FP32: params × 4 bytes
  FP16: params × 2 bytes
  INT8: params × 1 byte
  INT4: params × 0.5 bytes

KV Cache (LLMs) = 2 × layers × kv_heads × head_dim × seq_len × bytes_per_element

Peak inference memory ≈ weight_memory × 1.2  (activations + intermediate tensors + overhead)
```

### Quick Reference

| Model Size | FP16 | INT8 | INT4 | Peak (INT4) |
|-----------|------|------|------|-------------|
| 125M | 250 MB | 125 MB | 63 MB | ~75 MB |
| 350M | 700 MB | 350 MB | 175 MB | ~210 MB |
| 1B | 2 GB | 1 GB | 500 MB | ~600 MB |
| 3B | 6 GB | 3 GB | 1.5 GB | ~1.8 GB |
| 7B | 14 GB | 7 GB | 3.5 GB | ~4.2 GB |
| 8B | 16 GB | 8 GB | 4 GB | ~4.8 GB |
| 13B | 26 GB | 13 GB | 6.5 GB | ~7.8 GB |

### Device Memory Budgets

**iPhone**: ~4 GB usable (iPhone 15), ~6 GB (15 Pro / 16), ~8 GB (16 Pro / 16 Pro Max)
**Android**: 4 GB (budget), 6 GB (mid-range), 8-12 GB (flagship)

**Rule of thumb**: Your model should use <50% of available RAM. The OS, your app, and other processes need the rest. An 8B INT4 model at 4.8GB peak is tight even on 8GB devices.

---

## Attention Optimization

| Technique | Memory Impact | Speed Impact | Platform | Notes |
|-----------|--------------|-------------|----------|-------|
| Grouped-Query Attention (GQA) | Smaller KV cache | Neutral | All | Fewer KV heads, same quality |
| Multi-Query Attention (MQA) | Smallest KV cache | Fastest | All | Single KV head, slight quality loss |
| Sliding Window Attention | Bounded memory | Fast | All | Great for streaming, fixed context |
| Split Einsum | N/A | 2-4x on ANE | iOS only | Reformulates for ANE convolution engine |
| Flash Attention | Reduced peak | Faster | GPU | Fused attention kernel, automatic in many frameworks |
| Paged Attention | Reduced fragmentation | Neutral | Server | vLLM/TGI pattern, less relevant on mobile |

**For mobile**: Prefer models with GQA (Llama 3.x, Gemma, Qwen). Split einsum for iOS ANE targets (see `coreml-optimization` skill). Flash Attention handled automatically by most runtimes.

---

## Diffusion Optimization

### Step Reduction
- **LCM-LoRA**: Drop-in adapter (~100MB), reduces 50 steps → 2-4 steps. Works with SD 1.5, SDXL.
  ```python
  from diffusers import LCMScheduler
  pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
  pipe.load_lora_weights("latent-consistency/lcm-lora-sdv1-5")
  image = pipe("prompt", num_inference_steps=4, guidance_scale=1.0).images[0]
  ```
- **Scheduler choice**: LCM (fastest), DPM++ 2M Karras (fast + good quality), Euler (best quality)
- **CFG-free models**: SD-Turbo, SDXL-Turbo run without classifier-free guidance — halves compute

### Memory Optimization
- **Latent space**: Always work in latent space (4×64×64 vs 3×512×512 = 48x smaller)
- **VAE tiling**: Split large images into overlapping tiles for decode — saves ~50% peak memory
- **Sequential offloading**: Run one model component at a time (text encoder → UNet → VAE)
- **Float16**: UNet and text encoder safe at FP16. VAE decoder sometimes needs FP32 for color accuracy.

### Architecture Tips
- UNet attention blocks are the bottleneck — focus quantization/optimization there
- Text encoder is small — often not worth quantizing
- VAE has complex ops (GroupNorm, SiLU) — often runs on CPU/GPU even when UNet is on NPU
- Scheduler math runs on CPU (trivial compute, don't optimize)

---

## Quality Validation

### Metrics by Model Type

**LLMs — Perplexity** (lower is better, Llama-3.1-8B on WikiText):
```
FP16 baseline: 6.14
Q4_K_M GGUF:   6.19  ← best 4-bit (+0.8% ppl)
AWQ 4-bit:     6.84  ← good (+11% ppl, but task accuracy stays >99%)
GPTQ 4-bit:    6.90  ← good (+12% ppl)
Q2_K GGUF:     7.25  ← degraded (+18% ppl)

Perplexity overstates real-world degradation for AWQ/GPTQ — task-specific
benchmarks (MMLU, HumanEval, etc.) show <2% accuracy drop at 4-bit.
Flag anything >15% perplexity increase for review.
```

**Diffusion — CLIP Score** (higher is better) + **FID** (lower is better):
- Measure on 500+ generations with diverse prompts vs reference set
- CLIP score <0.25 indicates prompt-image misalignment
- FID >50 indicates significant quality degradation

**TTS — MOS** (1-5, higher is better) + **CER** (lower is better):
- Compare against reference audio
- MOS <3.5 is generally unacceptable for production

**ASR — WER** (lower is better):
- Benchmark on LibriSpeech test-clean
- Flag >1% absolute WER increase from quantization

**General rule**: Run quantized model vs FP16 on identical eval set. Flag >5% task-specific degradation. Some tasks (coding, math, STEM) degrade more than general QA at INT4.

### Benchmarking Methodology

Metrics that matter for mobile:
- **Tokens/sec** (LLMs): measure prefill AND decode separately — prefill is batch matmul, decode is sequential
- **Time-to-first-token**: user-perceived latency, often more important than throughput
- **Inference latency**: report p50 AND p95, not averages — tail latency matters on phones
- **Memory high-water mark**: peak RSS during inference, not model size alone
- **Thermal throttling**: sustained performance over 5+ minutes — phones throttle aggressively
- **Power consumption**: mW during inference — directly impacts battery life
- **Binary size increase**: compressed model weight added to app bundle (app store limits)

---

## Common Pitfalls

1. **Quantizing too aggressively**: Start with Q4_K_M / AWQ 4-bit. Only go lower if memory demands it. Quality drops are non-linear below 4-bit.
2. **Ignoring KV cache memory**: A 1B model might only need 500MB for weights but KV cache at 4096 context adds 200MB+. Always budget for it.
3. **Testing on desktop, deploying on phone**: Desktop GPUs hide inefficiencies. Always benchmark on target device — ANE, Hexagon NPU, and mobile GPUs behave very differently.
4. **Wrong calibration data**: AWQ/GPTQ quality depends on calibration data matching your deployment domain. Generic C4/WikiText works for general models, but domain-specific data is better.
5. **Forgetting activation memory**: Weight compression is only half the story. Activations during inference can be 20-50% of peak memory.
6. **Skipping thermal testing**: Phone runs great for 30 seconds, then throttles 40%. Test sustained inference.
