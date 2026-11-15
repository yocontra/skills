# Conversion pipeline

## Option A: torch.jit.trace (stable, full op coverage)

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
    minimum_deployment_target=ct.target.iOS18,  # iOS18+ for most compression
    compute_precision=ct.precision.FLOAT16,    # FLOAT16 or FLOAT32
    compute_units=ct.ComputeUnit.ALL,
)
mlmodel.save("model.mlpackage")
```

## Option B: torch.export (newer, auto-infers shapes)

```python
from torch.export import export

exported = export(model.eval(), (example_input,))
mlmodel = ct.convert(
    exported,
    # no inputs/outputs needed, inferred from the export signature
    minimum_deployment_target=ct.target.iOS18,
    compute_precision=ct.precision.FLOAT16,
)
```

Op coverage is still expanding, so not every PyTorch op converts; fall back to
`torch.jit.trace` when one fails. `torch.export.Dim()` declares dynamic shapes. coremltools
8.x has less `torch.export` coverage than 9.0, which is tested up to PyTorch 2.7.

## ONNX source

coremltools has had no ONNX frontend since 6.0; `ct.convert` accepts only PyTorch,
TensorFlow, and MIL programs. Convert from the PyTorch model; if only an ONNX file exists,
use ONNX Runtime with its Core ML execution provider instead.

## Shapes

```python
# Fixed shape (ANE-friendly, fastest):
ct.TensorType(name="input", shape=(1, 3, 224, 224))

# Flexible shape (versatile, may prevent ANE):
ct.TensorType(name="input", shape=ct.Shape(
    shape=(1, 3, ct.RangeDim(lower_bound=128, upper_bound=512, default=224),
                 ct.RangeDim(lower_bound=128, upper_bound=512, default=224))
))

# Enumerated shapes (ANE-friendly, several fixed sizes):
ct.TensorType(name="input", shape=ct.EnumeratedShapes(
    shapes=[(1, 3, 224, 224), (1, 3, 384, 384), (1, 3, 512, 512)]
))
```

Fixed shapes for the ANE; `EnumeratedShapes` for a few sizes; `RangeDim` only for GPU/CPU targets.

## Compilation

```bash
# .mlpackage -> .mlmodelc (what ships in the app bundle)
xcrun coremlcompiler compile model.mlpackage output_dir/
```

The `.mlmodelc` is optimized for the compilation host's macOS version. Keep the
`.mlpackage` and recompile when targeting new OS versions.

## Deployment targets

| Target | Key features |
|--------|--------------|
| `ct.target.iOS16` | mlprogram format, basic ANE ops |
| `ct.target.iOS17` | MLComputePlan, expanded op set |
| `ct.target.iOS18` | Stateful models (KV cache), per-grouped-channel palettization, INT4 / per-block quantization, joint compression |
