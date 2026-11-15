# Quantization methods

## AWQ (recommended for mobile LLMs)

Activation-aware Weight Quantization preserves salient weights, chosen by activation magnitude.
AutoAWQ is deprecated (its README points to vLLM's `llm-compressor`); quantize with
`gptqmodel`, which implements AWQ with the same load/quantize/save flow as GPTQ, or with
`llm-compressor`'s `AWQModifier` when the target is vLLM.

```python
from gptqmodel import AWQConfig, GPTQModel

config = AWQConfig(bits=4, group_size=128)  # format defaults to GEMM
model = GPTQModel.load("meta-llama/Llama-3.1-8B", config)
model.quantize(calibration_dataset, batch_size=1)  # list of text samples from the target domain
model.save("llama-3.1-8b-awq")
```

Key parameters:

- `group_size`: 128 (standard), 64 (better quality, slightly larger), 32 (best quality).
- Kernel format: GEMM (the default) handles long contexts and batches up to ~8; GEMV is
  ~20% faster at batch size 1 but poor with long contexts.

## GPTQ

Post-training quantization using approximate second-order (Hessian) information.
AutoGPTQ is deprecated; use `gptqmodel`.

```python
from gptqmodel import GPTQConfig, GPTQModel

config = GPTQConfig(
    bits=4,
    group_size=128,
    desc_act=False,       # True: ~0.05 ppl better, but slower and breaks some kernels
)
model = GPTQModel.load("meta-llama/Llama-3.1-8B", config)
model.quantize(calibration_dataset, batch_size=1)  # ~128+ samples from the target distribution
model.save("llama-3.1-8b-gptq")
```

`desc_act` (descending activation order) improves perplexity by ~0.05 but makes inference
sequential and breaks Marlin/ExLlama kernels. Use `False` for mobile. Current GPTQModel
defaults to `desc_act=False` with activation-group-aware ordering (`act_group_aware=True`),
which recovers most of that quality without the kernel penalty. `QuantizeConfig` still
works as a generic factory; `GPTQConfig` and `AWQConfig` are the concrete classes.

## GGUF / llama.cpp

The standard for llama.cpp deployments. Most types need no calibration data.

```bash
# Step 1: HuggingFace -> GGUF
python convert_hf_to_gguf.py /path/to/hf-model \
    --outtype f16 \
    --outfile model-f16.gguf

# Step 2: quantize
llama-quantize model-f16.gguf model-q4km.gguf Q4_K_M

# With an importance matrix (better quality for IQ and low-bit K types):
llama-imatrix -m model-f16.gguf -f calibration.txt -o imatrix.gguf
llama-quantize --imatrix imatrix.gguf model-f16.gguf model-iq4xs.gguf IQ4_XS
```

### Quant types

Bits per weight and file size for Llama-3.1-8B (F16 is 16.00 BPW, 14.96 GiB), from the
llama.cpp quantize README:

| Type | BPW | Size (8B) | Notes |
|------|-----|-----------|-------|
| Q8_0 | 8.50 | 7.95 GiB | Near-lossless, if the RAM is there |
| Q6_K | 6.56 | 6.14 GiB | High quality, moderate savings |
| Q5_K_M | 5.70 | 5.33 GiB | Great quality/size balance |
| Q4_K_M | 4.89 | 4.58 GiB | Recommended for mobile |
| Q4_K_S | 4.67 | 4.36 GiB | Tighter memory budget |
| IQ4_XS | 4.46 | 4.17 GiB | Smallest good 4-bit; quantize with an imatrix |
| Q3_K_M | 4.00 | 3.74 GiB | Noticeable quality loss |
| Q2_K | 3.16 | 2.95 GiB | Last resort, significant degradation |

The lowest-bit IQ1/IQ2 types refuse to quantize without an imatrix; for the rest it is
optional but improves quality.

## ONNX Runtime

For ONNX Runtime Mobile deployments.

```python
from onnxruntime.quantization import (
    quantize_dynamic, quantize_static, QuantType, QuantFormat, CalibrationDataReader,
)

# Dynamic quantization (no calibration data)
quantize_dynamic(
    "model.onnx",
    "model_int8.onnx",
    weight_type=QuantType.QInt8,
)

# Static quantization (better quality, needs calibration)
class MyCalibReader(CalibrationDataReader):
    def get_next(self):
        # return a dict of input_name -> numpy array, or None when exhausted
        ...

quantize_static(
    "model.onnx",
    "model_int8_static.onnx",
    calibration_data_reader=MyCalibReader(),
    quant_format=QuantFormat.QDQ,  # QDQ for NPU/GPU delegates
    per_channel=True,
)
```

Graph optimization levels via `optimum-cli export onnx --optimize` (install
`optimum-onnx[onnxruntime]`); none of them quantize:

- O1: basic general optimizations
- O2: O1 plus extended optimizations and transformer fusions (attention, skip-layer-norm)
- O3: O2 plus GELU approximation
- O4: O3 plus FP16 mixed precision, GPU only (`--device cuda`); not for mobile CPU/NPU

```bash
optimum-cli export onnx --model meta-llama/Llama-3.1-8B --optimize O2 ./output/
```

## Core ML

coremltools has its own weight compression (palettization, INT4 per-block, joint A8W4
compression). Those APIs, their parameters, and the ANE-specific rules live in the
`coreml-optimization` skill.
