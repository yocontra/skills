# ExecuTorch export and Android runtime

ExecuTorch is PyTorch's official on-device inference framework: export from Python to a
`.pte` file, then load it on device. The `.pte` holds the graph with delegation baked
in, so backend selection happens at export time, not at runtime.

## Contents

- [Basic export (XNNPACK, CPU)](#basic-export-xnnpack-cpu)
- [XNNPACK INT8 symmetric quantization (PT2E)](#xnnpack-int8-symmetric-quantization-pt2e)
- [XNNPACK INT4 groupwise quantization (torchao)](#xnnpack-int4-groupwise-quantization-torchao)
- [QNN backend (Qualcomm Hexagon NPU)](#qnn-backend-qualcomm-hexagon-npu)
- [MediaTek NeuroPilot backend](#mediatek-neuropilot-backend)
- [Samsung Exynos NPU](#samsung-exynos-npu)
- [Android runtime integration](#android-runtime-integration)

## Basic export (XNNPACK, CPU)

XNNPACK works on every Android device and is optimized for ARM NEON, SVE and SME.

```python
import torch
from torch.export import export
from executorch.backends.xnnpack.partition.xnnpack_partitioner import XnnpackPartitioner
from executorch.exir import to_edge_transform_and_lower, EdgeCompileConfig

# 1. Export
model.eval()
sample_inputs = (torch.randn(1, 3, 224, 224),)
exported = export(model, sample_inputs)

# 2. Edge transform + XNNPACK delegation
edge = to_edge_transform_and_lower(
    exported,
    partitioner=[XnnpackPartitioner()],
    compile_config=EdgeCompileConfig(_check_ir_validity=False),
)

# 3. Serialize to .pte
exec_prog = edge.to_executorch()
with open("model.pte", "wb") as f:
    exec_prog.write_to_file(f)
```

## XNNPACK INT8 symmetric quantization (PT2E)

Two-stage export: export once to quantize, then export the quantized module.

```python
from torch.export import export
from torchao.quantization.pt2e.quantize_pt2e import convert_pt2e, prepare_pt2e
from executorch.backends.xnnpack.quantizer.xnnpack_quantizer import (
    get_symmetric_quantization_config,
    XNNPACKQuantizer,
)
from executorch.backends.xnnpack.partition.xnnpack_partitioner import XnnpackPartitioner
from executorch.exir import to_edge_transform_and_lower, EdgeCompileConfig

# 1. Export for quantization
model_to_quantize = export(model.eval(), sample_inputs).module()

# 2. Configure quantizer
quantizer = XNNPACKQuantizer()
quantizer.set_global(get_symmetric_quantization_config(
    is_per_channel=True,   # per-channel gives better quality
    is_dynamic=False,      # static quantization, needs calibration
))

# 3. Prepare, calibrate, convert
prepared = prepare_pt2e(model_to_quantize, quantizer)
for batch in calibration_dataloader:
    prepared(*batch)
quantized = convert_pt2e(prepared)

# 4. Export to ExecuTorch
exported = export(quantized, sample_inputs)
edge = to_edge_transform_and_lower(
    exported,
    partitioner=[XnnpackPartitioner()],
    compile_config=EdgeCompileConfig(_check_ir_validity=False),
)
exec_prog = edge.to_executorch()
with open("model_int8.pte", "wb") as f:
    exec_prog.write_to_file(f)
```

## XNNPACK INT4 groupwise quantization (torchao)

For LLMs. `quantize_` is not backend-aware, so use the configs XNNPACK lowers: 8-bit
dynamic activations with 4-bit grouped weights for linear layers. `Int4WeightOnlyConfig`
targets CUDA kernels and does not lower to XNNPACK.

```python
import torch
from torchao.quantization.granularity import PerGroup
from torchao.quantization.quant_api import Int8DynamicActivationIntxWeightConfig, quantize_

model.eval()
quantize_(model, Int8DynamicActivationIntxWeightConfig(
    weight_dtype=torch.int4,
    weight_granularity=PerGroup(32),
))

exported = export(model, sample_inputs)
edge = to_edge_transform_and_lower(exported, partitioner=[XnnpackPartitioner()])
with open("model_int4.pte", "wb") as f:
    edge.to_executorch().write_to_file(f)
```

`group_size`: 32 is standard, 64 is smaller with slightly worse quality, 128 is the most
compact. Start with 32.

## QNN backend (Qualcomm Hexagon NPU)

Runs on the Hexagon Tensor Processor (HTP), dedicated NPU silicon on Snapdragon.

Requirements: the QNN SDK on the build machine, an INT8-quantized model (HTP does not run
FP32), and the target chipset fixed at compile time.

```python
from torch.export import export
from torchao.quantization.pt2e.quantize_pt2e import convert_pt2e, prepare_pt2e
from executorch.backends.qualcomm.utils.utils import (
    generate_qnn_executorch_compiler_spec,
    generate_htp_compiler_spec,
    QcomChipset,
    to_edge_transform_and_lower_to_qnn,
)
from executorch.backends.qualcomm.quantizer.quantizer import QnnQuantizer

# 1. Quantize for HTP (INT8 QDQ)
quantizer = QnnQuantizer()
prepared = prepare_pt2e(
    export(model.eval(), sample_inputs, strict=True).module(),
    quantizer,
)
for batch in calibration_dataloader:
    prepared(*batch)
quantized = convert_pt2e(prepared)

# 2. Compile for the target chipset
backend_options = generate_htp_compiler_spec(use_fp16=False)
compile_spec = generate_qnn_executorch_compiler_spec(
    soc_model=QcomChipset.SM8650,  # Snapdragon 8 Gen 3
    backend_options=backend_options,
)

# 3. Delegate and export
delegated = to_edge_transform_and_lower_to_qnn(quantized, sample_inputs, compile_spec)
exec_prog = delegated.to_executorch()
with open("model_qnn.pte", "wb") as f:
    exec_prog.write_to_file(f)
```

| `QcomChipset` | SoC | Devices |
|---------------|-----|---------|
| `SM8550` | Snapdragon 8 Gen 2 | Galaxy S23, 2023 flagships |
| `SM8650` | Snapdragon 8 Gen 3 | Galaxy S24 Ultra, OnePlus 12, Xiaomi 14 |
| `SM8750` | Snapdragon 8 Elite | Galaxy S25, 2025 flagships |
| `SM8850` | Snapdragon 8 Elite Gen 5 | Late-2025/2026 flagships |
| `SM7675` | Snapdragon 7+ Gen 3 | Mid-range 2024–2025 |

Read a device's SoC with `adb shell getprop ro.soc.model`; the full enum is in
`backends/qualcomm/serialization/qc_schema.py`. Recent ExecuTorch also accepts a list of
chipsets (with a matching list of backend options) and emits a flexible context binary
that runs on exactly those SoCs; it is not a runtime fallback for other chips.

FP16 on HTP: pass `use_fp16=True` to `generate_htp_compiler_spec()`. Newer chipsets
support it, but INT8 is faster and preferred.

## MediaTek NeuroPilot backend

For Dimensity 9300, 9400 and 9500 (`platform-config` `mt6989`, `mt6991`, `mt6993`; the
backend README lists only 9300 and 9400 as tested). Compilation requires a Linux x86-64
host with MediaTek's NeuroPilot Express SDK wheels; it does not work on macOS.

```python
from executorch.backends.mediatek.quantizer import NeuropilotQuantizer, Precision
from torchao.quantization.pt2e.quantize_pt2e import convert_pt2e, prepare_pt2e
from torch.export import export

quantizer = NeuropilotQuantizer()
quantizer.setup_precision(Precision.A16W4)
# Options: A16W16, A16W8, A16W4, A8W8, A8W4

prepared = prepare_pt2e(export(model, sample_inputs).module(), quantizer)
for batch in calibration_dataloader:
    prepared(*batch)
quantized = convert_pt2e(prepared)

from executorch.backends.mediatek import NeuropilotPartitioner
from executorch.exir import to_edge_transform_and_lower
from executorch.exir.backend.backend_details import CompileSpec

edge = to_edge_transform_and_lower(
    export(quantized, sample_inputs, strict=True),
    partitioner=[NeuropilotPartitioner([CompileSpec("platform-config", b"mt6991")])],  # D9400
)
with open("model_mtk.pte", "wb") as f:
    edge.to_executorch().write_to_file(f)
```

The device also needs MediaTek's runtime libraries (`libneuron_backend.so`,
`libneuronusdk_adapter.mtk.so`, `libneuron_buffer_allocator.so`) from the same SDK.

## Samsung Exynos NPU

ExecuTorch's Samsung (Exynos) backend is the newest and thinnest-documented:

- Supported chipsets: Exynos 2500 (`e9955`) and Exynos 2600 (`e9965`). The Exynos 2400 is
  not supported, so Exynos Galaxy S24s take the XNNPACK path.
- Toolchain: Samsung's Exynos AI LiteCore SDK on a Linux x86-64 host
  (`EXYNOS_AI_LITECORE_ROOT`); see `backends/samsung/README.md` and
  `python -m executorch.examples.samsung.aot_compiler --chipset e9955 ...`.
- Quantization: INT8/INT16 (FP16 is also supported).
- Most Samsung flagships sold globally use Snapdragon. Optimize QNN first, Exynos
  second, and use QNN for Snapdragon Samsung devices.

## Android runtime integration

### Gradle

```kotlin
// build.gradle.kts
dependencies {
    // Match the version of the executorch pip package that exported the .pte
    // (1.5.1 is the latest on Maven Central as of November 2026).
    implementation("org.pytorch:executorch-android:1.5.1")
    // XNNPACK flavor: portable, quantized and XNNPACK ops; arm64-v8a and x86_64.
    // QNN and Vulkan builds ship as separate AARs (FLAVOR qnn / vulkan) from the release S3.
}
```

### Java

```java
import org.pytorch.executorch.EValue;
import org.pytorch.executorch.Module;
import org.pytorch.executorch.Tensor;

Module module = Module.load(assetFilePath("model.pte"));

float[] inputData = new float[]{1.0f, 2.0f, 3.0f};
long[] inputShape = new long[]{1, 3};
Tensor inputTensor = Tensor.fromBlob(inputData, inputShape);

EValue[] result = module.forward(EValue.from(inputTensor));
float[] output = result[0].toTensor().getDataAsFloatArray();
```

### Kotlin

```kotlin
import org.pytorch.executorch.Module
import org.pytorch.executorch.Tensor
import org.pytorch.executorch.EValue

val module = Module.load(modelPath)
val input = Tensor.fromBlob(floatArrayOf(1.0f, 2.0f, 3.0f), longArrayOf(1, 3))
val outputs = module.forward(EValue.from(input))
val result = outputs[0].toTensor().dataAsFloatArray
```

The runtime uses whatever backend the `.pte` was compiled for (XNNPACK, QNN, MediaTek);
no runtime backend selection is needed beyond picking which file to load.
