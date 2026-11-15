# Profiling on-device inference

## Snapdragon Profiler

Qualcomm's profiler for NPU, GPU and CPU activity:

- HTP utilization during inference
- Thermal throttling
- Memory bandwidth and cache hit rates
- Power breakdown by compute unit

## Android GPU Inspector (AGI)

Google's GPU profiler:

- GPU delegate performance counters
- Shader execution time
- Memory allocation patterns

## ExecuTorch built-in profiling

Generate an ETRecord at export, collect an ETDump at runtime, and join them with the
Inspector:

```python
from executorch.exir import to_edge_transform_and_lower

edge = to_edge_transform_and_lower(exported, partitioner=[...], generate_etrecord=True)
et_program = edge.to_executorch()
et_program.get_etrecord().save("model.etrecord")
```

Run the model with a runtime built with the event tracer (`ETDumpGen`) to produce an
`.etdump`, then summarize it rather than printing every event:

```python
from executorch.devtools import Inspector

inspector = Inspector(etdump_path="model.etdump", etrecord="model.etrecord")
inspector.print_data_tabular()  # per-op and per-delegate timing
```

## Perfetto system trace

Capture a bounded 10-second trace while inference runs:

```bash
adb shell perfetto -o /data/misc/perfetto-traces/trace.perfetto-trace \
    -t 10s sched freq idle am wm gfx view binder_driver hal \
    dalvik camera input res
adb pull /data/misc/perfetto-traces/trace.perfetto-trace
```

Look for inference duration, thread scheduling, GPU/NPU activity and memory-pressure
events.

## Metrics to track

| Metric | Tool | Target |
|--------|------|--------|
| Inference latency | Custom timing | p50 under target, p95 under 2x target |
| NPU utilization | Snapdragon Profiler | Over 80% during inference |
| Thermal throttling | `adb shell dumpsys thermalservice` | No sustained performance drop |
| Memory (RSS) | `adb shell dumpsys meminfo <package>` | Peak under 50% of device RAM |
| Battery drain | `adb shell dumpsys batterystats <package>` | mAh per inference session |

`dumpsys` output is long; scope it to the app package and filter it (`| grep -A20 TOTAL`,
`| head -50`) rather than reading it whole.

Measure sustained performance over 5+ minutes of continuous inference, not a 10-second
burst; throttling shows up after the phone heats.
