# Split einsum

Split einsum lives in Apple's `ml-stable-diffusion` project, not in coremltools.

```python
# ml-stable-diffusion/python_coreml_stable_diffusion/unet.py
class AttentionImplementation(Enum):
    ORIGINAL = "ORIGINAL"                # Standard attention (CPU/GPU)
    SPLIT_EINSUM = "SPLIT_EINSUM"        # ANE-friendly attention
    SPLIT_EINSUM_V2 = "SPLIT_EINSUM_V2"  # Optimized ANE attention (10-30% faster)
```

## Converting a Stable Diffusion UNet

```bash
python -m python_coreml_stable_diffusion.torch2coreml \
    --model-version stabilityai/stable-diffusion-2-1 \
    --attention-implementation SPLIT_EINSUM_V2 \
    --convert-unet \
    --bundle-resources-for-swift-cli \
    -o output/
```

For the SDXL UNet, Apple recommends `SPLIT_EINSUM` for iPhone/iPad (`cpuAndNeuralEngine`) and
`ORIGINAL` for Mac (`cpuAndGPU`). Never `SPLIT_EINSUM_V2` on SDXL: its compile time is
prohibitive. The SDXL command adds `--xl-version` and uses
`--model-version stabilityai/stable-diffusion-xl-base-1.0`.

## Rewriting attention in a custom transformer

```python
# Before (standard, bad for ANE):
# Q: [B, heads, seq_q, dim]  K: [B, heads, seq_k, dim]  V: [B, heads, seq_k, dim]
attn_weights = torch.einsum("bnqd,bnkd->bnqk", Q, K) / math.sqrt(dim)
attn_weights = torch.softmax(attn_weights, dim=-1)
output = torch.einsum("bnqk,bnkd->bnqd", attn_weights, V)

# After (split einsum, ANE-friendly):
# Channel-first: Q: [B, dim, heads, seq_q]  K: [B, dim, heads, seq_k]
Q = Q.permute(0, 3, 1, 2)  # [B, dim, heads, seq_q]
K = K.permute(0, 3, 1, 2)  # [B, dim, heads, seq_k]
V = V.permute(0, 3, 1, 2)  # [B, dim, heads, seq_k]

# Chunk along the head dim to stay within ANE limits
chunks_q = Q.split(1, dim=2)  # list of [B, dim, 1, seq_q]
chunks_k = K.split(1, dim=2)
chunks_v = V.split(1, dim=2)

attn_out = []
for q, k, v in zip(chunks_q, chunks_k, chunks_v):
    # 4D conv-like ops, native on the ANE
    attn = torch.einsum("bchq,bchk->bqk", q, k) / math.sqrt(dim)
    attn = torch.softmax(attn, dim=-1)
    out = torch.einsum("bqk,bchk->bchq", attn, v)
    attn_out.append(out)

output = torch.cat(attn_out, dim=2)  # [B, dim, heads, seq_q]
output = output.permute(0, 2, 3, 1)  # back to [B, heads, seq_q, dim]
```

Do the permutes once at the model boundary, not per layer, so the hot path stays
reshape-free. V2 processes several heads together instead of chunking one at a time,
for a further 10–30% on mobile ANE, but it is only available through `ml-stable-diffusion`'s
conversion pipeline.
