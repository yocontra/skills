# Workload-specific guidance

## LLMs: disaggregated inference

Split prefill and decode across compute units for throughput and power efficiency:

- Prefill (processing the prompt) on the ANE: bulk matrix multiply, the ANE's strength.
- Decode (generating tokens) on the GPU: sequential single-token generation.

### ANEMLL

Open-source ANE LLM framework supporting Llama 3.2, Qwen 3, Gemma 3, DeepSeek R1, and
others; the current model list is in the [ANEMLL repo](https://github.com/Anemll/Anemll).
It splits models into ANE-sized chunks automatically.

```bash
# --lut1 / --lut2 / --lut3: LUT bits for embeddings / FFN and prefill / LM head
./anemll/utils/convert_model.sh \
    --model meta-llama/Llama-3.2-1B \
    --output ./models/llama-1b/ \
    --context 4096 \
    --batch 64 \
    --chunk 1 \
    --lut2 6 \
    --lut3 6
```

Requirements: macOS Sequoia or later, Apple silicon, Python 3.9–3.11 (3.9 recommended),
Xcode command-line tools. `--chunk` defaults to 2 (`auto` splits by `--max-chunk-mb`).

Memory follows the bit width: an 8B model is ~16 GB at FP16 and roughly 6 GB at LUT-6, so
8B targets Macs and high-RAM devices; 1B–3B models are the practical iPhone range.

## Diffusion

### UNet / transformer

- Split einsum on attention blocks, the single biggest ANE win: V2 for SD 1.5/2.x, plain
  `SPLIT_EINSUM` for SDXL (V2 compile time is prohibitive there; see
  [split-einsum.md](split-einsum.md)).
- 4-bit palettization for weights.
- Fixed input shapes, e.g. latent `[1, 4, 64, 64]`, timestep `[1]`,
  `encoder_hidden_states` `[1, 77, 768]`.
- `computeUnits = .cpuAndNeuralEngine`.

### VAE

- GroupNorm and SiLU often fall back to CPU/GPU.
- Keep it at `.cpuAndGPU` or `.all`.
- The VAE decoder sometimes needs FP32 for color accuracy; compare outputs against FP32.

### Memory

- Peak during a UNet denoising step: ~300–500 MB for SD 1.5, ~1–2 GB for SDXL.
- Run one component at a time to cut the peak: load text encoder, unload, load UNet,
  unload, load VAE.

Step reduction (LCM-LoRA, turbo models, schedulers) is framework-independent and covered by
the `model-quantization` skill.

## Audio (TTS / ASR)

### LSTM / GRU

Recurrent ops have limited ANE support and often run CPU-only. Use `.cpuOnly` for recurrent
models, or `.all` and let the runtime decide.

### Streaming

- Use fixed chunk sizes, e.g. 512 samples = 32 ms at 16 kHz.
- Carry recurrent state with stateful models (iOS 18+, see
  [stateful-models.md](stateful-models.md)) or manual state I/O.

### Signal processing

STFT/iSTFT belong in the Accelerate framework (vDSP) in Swift: faster and more accurate than
Core ML. Do not convert signal processing to Core ML; it is not what the ANE is good at.
