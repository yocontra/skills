# Mobile model architectures

## LLMs

| Model | Params | Mobile speed | Quality | Notes |
|-------|--------|--------------|---------|-------|
| SmolLM2 | 135M / 360M / 1.7B | 200+ tok/s | Good for size | Best tiny LLM family |
| MobileLLM | 125M / 350M | 120 tok/s | Decent | Meta's mobile-specific architecture |
| Qwen 3 | 0.6B / 1.7B / 4B | 100+ tok/s (0.6B) | Good to excellent | Strong multilingual |
| Gemma 3 | 1B / 4B | 47–62 tok/s (1B, ANE) | Strong | Best 1B quality |
| TinyLlama | 1.1B | 80 tok/s | Good | Chat-capable, well tested |
| Llama 3.2 | 1B / 3B | 30–50 tok/s | Excellent | Best quality/size ratio |
| Phi-4-mini | 3.8B | 20–30 tok/s | Excellent | Strong reasoning; successor to Phi-3.5 Mini |

By memory budget: under 2 GB, SmolLM2 360M or Qwen 0.6B; 2–4 GB, Gemma/Llama 1B; 4–6 GB,
Llama 3B or Phi-4-mini. Do not try 7B+ on phones below 8 GB RAM.

## Diffusion

| Model | Params | Steps | Phone speed | Quality | Notes |
|-------|--------|-------|-------------|---------|-------|
| BK-SDM-Tiny | 0.50B | 25 | ~4 s (iPhone 14) | OK | Smallest SD variant |
| SD-Turbo | 0.86B | 1–4 | ~2 s | Good | Distilled SD 2.1 |
| SDXL-Turbo | 2.6B | 1–4 | ~6 s | Excellent | Needs 6 GB+ RAM |
| LCM-LoRA + SD 1.5 | 0.86B + 100 MB | 2–4 | ~1.5 s | Good | Drop-in adapter |
| EdgeFusion | ~0.5B | 2 | <1 s (NPU) | Good | NPU-optimized |

By quality target: quick previews, EdgeFusion or SD-Turbo; good quality, LCM-LoRA + SD 1.5;
best quality, SDXL-Turbo if RAM allows.

## TTS / ASR

| Model | Type | Size | Latency | Quality | Notes |
|-------|------|------|---------|---------|-------|
| Kokoro | TTS | ~80 MB | <500 ms | Excellent | Best small TTS |
| Piper | TTS | 15–60 MB | <200 ms | Good | ONNX, many voices |
| WhisperKit tiny | ASR | ~40 MB | 460 ms | ~7.5% WER | Apple-optimized; English-only `tiny.en` is better |
| Whisper small | ASR | ~240 MB | ~2 s | ~3.4% WER | Good balance |
| Whisper large-v3-turbo | ASR | ~800 MB | ~4 s | ~2–3% WER | Best quality |
| Silero VAD | VAD | ~2 MB | <10 ms | Excellent | Voice activity only |

## Vision

| Model | Type | Size | Latency | Notes |
|-------|------|------|---------|-------|
| MobileNetV3 | Classification | ~5 MB | <10 ms | Standard mobile vision |
| EfficientNet-Lite | Classification | 5–25 MB | 10–30 ms | Better accuracy |
| YOLOv8n | Detection | ~6 MB | ~15 ms | Real-time detection |
| MiDaS small | Depth | ~25 MB | ~50 ms | Monocular depth |
| SAM-tiny | Segmentation | ~40 MB | ~100 ms | Segment Anything, mobile |

## Attention techniques

| Technique | Memory impact | Speed impact | Platform | Notes |
|-----------|---------------|--------------|----------|-------|
| Grouped-query attention (GQA) | Smaller KV cache | Neutral | All | Fewer KV heads, same quality |
| Multi-query attention (MQA) | Smallest KV cache | Fastest | All | Single KV head, slight quality loss |
| Sliding window attention | Bounded memory | Fast | All | Great for streaming, fixed context |
| Split einsum | N/A | 2–4x on ANE | iOS only | Reformulates for the ANE; see `coreml-optimization` |
| Flash attention | Reduced peak | Faster | GPU | Fused kernel, automatic in many frameworks |
| Paged attention | Less fragmentation | Neutral | Server | vLLM/TGI pattern, less relevant on mobile |

For mobile, prefer GQA models (Llama 3.x, Gemma, Qwen). Most runtimes apply flash attention
automatically.

## Diffusion optimization

### Step reduction

LCM-LoRA is a drop-in adapter (~100 MB) that reduces 50 steps to 2–4; it works with SD 1.5
and SDXL.

```python
from diffusers import LCMScheduler

pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
pipe.load_lora_weights("latent-consistency/lcm-lora-sdv1-5")
image = pipe("prompt", num_inference_steps=4, guidance_scale=1.0).images[0]
```

- Scheduler choice: LCM (fastest), DPM++ 2M Karras (fast, good quality), Euler (best quality).
- CFG-free models: SD-Turbo and SDXL-Turbo run without classifier-free guidance, halving compute.

### Memory

- Work in latent space: 4×64×64 vs 3×512×512 is 48x smaller.
- VAE tiling: decode large images in overlapping tiles, saving ~50% peak memory.
- Sequential offloading: run one component at a time (text encoder, then UNet, then VAE).
- Float16: UNet and text encoder are safe at FP16; the VAE decoder sometimes needs FP32 for
  color accuracy.

### Where to spend effort

- UNet attention blocks are the bottleneck; focus quantization and optimization there.
- The text encoder is small and often not worth quantizing.
- The VAE has complex ops (GroupNorm, SiLU) and often runs on CPU/GPU even when the UNet is
  on the NPU.
- Scheduler math runs on CPU and is trivial; leave it alone.
