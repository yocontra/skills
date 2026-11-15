# Apple Foundation Models (iOS 26+)

A free, on-device ~3B language model built into iOS 26 and later, exposed through the
`FoundationModels` framework. It runs only on Apple Intelligence devices with the feature
enabled, so check availability before showing the feature.

```swift
import FoundationModels

switch SystemLanguageModel.default.availability {
case .available:
    break  // safe to create a LanguageModelSession
case .unavailable(let reason):
    print("Foundation Models unavailable: \(reason)")  // device, setting, or model not ready
}
```

## Basic generation

```swift
import FoundationModels

let session = LanguageModelSession()
let response = try await session.respond(to: "Describe this location")
print(response.content)

// Streaming: each element is a snapshot of the response so far
for try await partial in session.streamResponse(to: "Tell me a story") {
    print(partial)
}
```

## Structured output

```swift
@Generable
struct SpiritProfile {
    @Guide(description: "The spirit's name")
    var name: String

    @Guide(description: "Danger level from 1 to 10")
    var dangerLevel: Int

    @Guide(description: "Brief backstory")
    var backstory: String
}

let session = LanguageModelSession()
let profile = try await session.respond(
    to: "Create a ghost that haunts a Victorian mansion",
    generating: SpiritProfile.self
)
// profile.content.name, .dangerLevel, .backstory are typed
```

## Tool calling

```swift
struct LookupTool: Tool {
    let name = "lookup"
    let description = "Look up information in the database"

    @Generable
    struct Arguments {
        @Guide(description: "The search query")
        var query: String
    }

    func call(arguments: Arguments) async throws -> String {
        return "Result for: \(arguments.query)"
    }
}

let session = LanguageModelSession(tools: [LookupTool()])
let response = try await session.respond(to: "Look up haunted locations in Salem")
```

## Foundation Models or a custom model

| Use Apple Foundation Models | Use a custom model |
|-----------------------------|--------------------|
| General text tasks | Domain-specific (medical, legal, code) |
| Quick prototyping | Fine-tuned behavior |
| No model management wanted | Specific architecture needed |
| Languages in `SystemLanguageModel.default.supportedLanguages` | Other languages |
| iOS 26+ on Apple Intelligence devices | Older OS or non-Apple Intelligence devices |
