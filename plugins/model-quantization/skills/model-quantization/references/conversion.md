# Format ecosystem and conversion paths

```
                    ┌──────────────┐
                    │  HuggingFace │
                    │ (safetensors)│
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌───────────┐
        │   ONNX   │ │   GGUF   │ │  PyTorch  │
        │ (.onnx)  │ │ (.gguf)  │ │ (traced)  │
        └────┬─────┘ └──────────┘ └──┬────┬───┘
             │                       │    │
        ┌────▼─────┐          ┌─────▼┐  ┌▼─────────┐
        │  ONNX RT │          │CoreML│  │ExecuTorch│
        │  Mobile  │          │(.mlp)│  │  (.pte)  │
        └──────────┘          └──────┘  └──────────┘
```

## Recommended paths

| Target | Best path | Command |
|--------|-----------|---------|
| Core ML (.mlpackage) | PyTorch → coremltools | `ct.convert(traced_model, minimum_deployment_target=ct.target.iOS18)` |
| ExecuTorch (.pte) | PyTorch → torch.export → ExecuTorch | `to_edge_transform_and_lower(export(model, inputs), partitioner=[...])` |
| GGUF | HuggingFace → `convert_hf_to_gguf` → llama-quantize | `python convert_hf_to_gguf.py ... && llama-quantize ...` |
| ONNX Runtime Mobile | HuggingFace → optimum-cli (`pip install "optimum-onnx[onnxruntime]"`) | `optimum-cli export onnx --model ... ./output/` |
| LiteRT (.tflite) | PyTorch → `litert_torch` (`pip install litert-torch`, formerly ai-edge-torch) | `litert_torch.convert(model, inputs).export('model.tflite')` |

## Commands

```bash
# HuggingFace -> ONNX
optimum-cli export onnx --model meta-llama/Llama-3.1-8B ./onnx-output/

# HuggingFace -> GGUF
python convert_hf_to_gguf.py ./model-dir --outtype f16 --outfile model.gguf

# PyTorch -> ExecuTorch (XNNPACK CPU backend)
python -c "
from torch.export import export
from executorch.exir import to_edge_transform_and_lower
from executorch.backends.xnnpack.partition.xnnpack_partitioner import XnnpackPartitioner
edge = to_edge_transform_and_lower(export(model, inputs), partitioner=[XnnpackPartitioner()])
edge.to_executorch().write_to_file(open('model.pte', 'wb'))
"

# PyTorch -> Core ML (pip install coremltools)
python -c "
import coremltools as ct
import torch
traced = torch.jit.trace(model.eval(), example_input)
ct.convert(traced, minimum_deployment_target=ct.target.iOS18).save('model.mlpackage')
"

# ONNX -> Core ML: coremltools has had no ONNX frontend since 6.0. Convert from the
# PyTorch source, or run the ONNX file with ONNX Runtime's Core ML execution provider.

# Compile Core ML .mlpackage -> .mlmodelc
xcrun coremlcompiler compile model.mlpackage output_dir/
```

For Core ML beyond this one-line conversion (shapes, `torch.export`, stateful KV cache,
compression, compute units), use the `coreml-optimization` skill.
