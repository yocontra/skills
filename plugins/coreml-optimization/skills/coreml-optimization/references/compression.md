# Compression with coremltools

All examples start from a saved, uncompressed `.mlpackage` converted with
`minimum_deployment_target=ct.target.iOS18` or later. coremltools 9.0 raises a `ValueError`
for per-grouped-channel palettization, `enable_per_channel_scale`, INT4, `per_block`, and
joint compression on an iOS 17 model.

```python
import coremltools as ct
import coremltools.optimize.coreml as cto

model = ct.models.MLModel("model.mlpackage")
```

## 4-bit palettization (best for ANE)

Clusters weights into 2^n centroids with k-means. The ANE has hardware support for
palettized lookups.

```python
config = cto.OptimizationConfig(
    global_config=cto.OpPalettizerConfig(
        mode="kmeans",                     # kmeans, uniform, unique, or custom
        nbits=4,                           # {1, 2, 3, 4, 6, 8}
        granularity="per_grouped_channel", # per_tensor or per_grouped_channel
        group_size=16,                     # default 32; smaller = better quality, larger model
        enable_per_channel_scale=True,     # per-channel scale, improves quality
    )
)
model = cto.palettize_weights(model, config)
model.save("model_palettized.mlpackage")
```

`OpPalettizerConfig` parameters:

- `mode`: `"kmeans"` (best quality), `"uniform"` (fastest), `"unique"` (weights with few
  unique values), or custom.
- `nbits`: 4 is the sweet spot; 2-bit works for non-critical layers; 6 or 8 for sensitive layers.
- `granularity`: `"per_grouped_channel"` is almost always better than `"per_tensor"`.
- `group_size`: 32 by default; 16 gives better quality for a little more overhead.
- `enable_per_channel_scale`: leave it `True`; minimal size cost, significant quality gain.
- `weight_threshold`: tensors with this many elements or fewer are skipped (default 2048).

Load the model with `compute_units=ct.ComputeUnit.CPU_ONLY` before saving palettized
weights; the ANE can hang during `.save()` otherwise.

## INT4 per-block (best for GPU)

Linear quantization with block-wise scales. Better for GPU compute, less suited to the ANE.

```python
config = cto.OptimizationConfig(
    global_config=cto.OpLinearQuantizerConfig(
        mode="linear_symmetric",   # linear_symmetric or linear (asymmetric)
        dtype="int4",              # int4, uint4, int8, uint8
        granularity="per_block",   # per_tensor, per_channel, per_block
        block_size=32,             # block size for per_block granularity
    )
)
model = cto.linear_quantize_weights(model, config)
```

## Joint compression (A17 Pro / M4 and newer)

Palettization followed by linear quantization of the LUT, giving A8W4: the LUT entries are
INT8, which enables the fast int8×int8 ANE compute path.

```python
# Step 1: palettize
palette_config = cto.OptimizationConfig(
    global_config=cto.OpPalettizerConfig(
        mode="kmeans", nbits=4, granularity="per_grouped_channel",
        group_size=16, enable_per_channel_scale=True,
    )
)
palettized = cto.palettize_weights(model, palette_config)

# Step 2: linear-quantize the palettized model with joint compression.
# joint_compression=True requires per_tensor granularity and an iOS18+ model.
quant_config = cto.OptimizationConfig(
    global_config=cto.OpLinearQuantizerConfig(
        mode="linear_symmetric", dtype="int8", granularity="per_tensor",
    )
)
compressed = cto.linear_quantize_weights(palettized, quant_config, joint_compression=True)
compressed.save("model_a8w4.mlpackage")
```

Result: 4-bit effective weight precision with INT8 LUT entries, which triggers the
int8×int8 ANE datapath on A17 Pro / M4 and newer, for roughly 2x throughput over standard
4-bit. On older chips it still compresses but does not get the faster datapath.

## Order of operations

1. Convert to `.mlpackage` (FP16).
2. Compress the `.mlpackage`.
3. Compile to `.mlmodelc` with `xcrun coremlcompiler compile`.
4. Keep every `.mlpackage`; recompile after OS updates.
5. Compare against the FP16 model on the project's eval set.
