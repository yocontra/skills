# Profiling and debugging

## MLComputePlan (iOS 17+ / macOS 14+)

Reports which compute unit each operation is assigned to and its estimated cost.

```swift
import CoreML

let config = MLModelConfiguration()
config.computeUnits = .all

let plan = try await MLComputePlan.load(contentsOf: modelURL, configuration: config)

if case let .program(program) = plan.modelStructure,
   let main = program.functions["main"] {
    for op in main.block.operations {
        let usage = plan.deviceUsage(for: op)    // preferred + supported devices
        let cost = plan.estimatedCost(of: op)    // relative weight, 0...1
        let device = usage?.preferred            // .cpu, .gpu, or .neuralEngine
        print("Op: \(op.operatorName) -> \(String(describing: device)) (cost: \(cost?.weight ?? 0))")
    }
}
```

Look for ops on CPU that were expected on the ANE, and for reshape/transpose ops that break
ANE execution chains. Summarize as counts and cost share per device rather than printing
every op of a large model.

## Instruments

1. Open Instruments and choose the Core ML template.
2. Run the app through model inference.
3. Look for compute-unit switches (expensive), memory spikes, and ANE utilization gaps.

## Resident memory

```swift
import Darwin

func logMemory(label: String) {
    var info = mach_task_basic_info()
    var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
    _ = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
            task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
        }
    }
    let mb = Double(info.resident_size) / 1_048_576
    print("[\(label)] Memory: \(String(format: "%.1f", mb)) MB")
}
```

Benchmark on device; the simulator runs everything on CPU.
