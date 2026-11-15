# Stateful models (iOS 18+)

Managed state replaces explicit KV-cache inputs and outputs; the Core ML runtime owns the memory.

## PyTorch side

```python
class MyLLM(torch.nn.Module):
    def __init__(self, num_heads, max_seq, head_dim):
        super().__init__()
        # Buffers registered here become Core ML state
        self.register_buffer("k_cache", torch.zeros(1, num_heads, max_seq, head_dim))
        self.register_buffer("v_cache", torch.zeros(1, num_heads, max_seq, head_dim))

    def forward(self, x, position):
        k, v = self.compute_kv(x)
        self.k_cache[:, :, position:position+1, :] = k
        self.v_cache[:, :, position:position+1, :] = v
        return self.attend(x, self.k_cache[:, :, :position+1, :],
                              self.v_cache[:, :, :position+1, :])
```

## Conversion

```python
import coremltools as ct

traced = torch.jit.trace(model.eval(), example_inputs)

# State names must match the register_buffer names
k_state = ct.StateType(
    wrapped_type=ct.TensorType(shape=(1, num_heads, max_seq, head_dim)),
    name="k_cache",
)
v_state = ct.StateType(
    wrapped_type=ct.TensorType(shape=(1, num_heads, max_seq, head_dim)),
    name="v_cache",
)

mlmodel = ct.convert(
    traced,
    states=[k_state, v_state],
    minimum_deployment_target=ct.target.iOS18,  # required for stateful models
)
mlmodel.save("llm_stateful.mlpackage")
```

## Swift runtime

```swift
import CoreML

let config = MLModelConfiguration()
config.computeUnits = .all

let model = try MLModel(contentsOf: modelURL, configuration: config)
let state = model.makeState()  // allocates the KV cache

// Decode loop: state persists across calls
for position in 0..<maxTokens {
    let input = try MLDictionaryFeatureProvider(dictionary: [
        "input_ids": MLMultiArray(shape: [1, 1], dataType: .int32),
        "position": MLMultiArray(shape: [1], dataType: .int32),
    ])
    let result = try model.prediction(from: input, using: state)
    let logits = result.featureValue(for: "logits")!.multiArrayValue!
    // sample the next token from logits
}
```

The same mechanism carries recurrent state for streaming audio models; see
[workloads.md](workloads.md).
