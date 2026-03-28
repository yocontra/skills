# Skills

A collection of personal [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skills I use daily. These extend Claude Code with specialized capabilities -- from auditing codebases for bugs to managing stacked PRs with Graphite.

## What's included

| Skill | What it does |
|-------|-------------|
| **[bug-audit](./bug-audit)** | Dissects your codebase into audit tables (API endpoints, state machines, data flows, concurrency hotspots, etc.) then exhaustively verifies every entry. Includes red team/blue team adversarial analysis. |
| **[perf-audit](./perf-audit)** | Three-agent adversarial performance analysis. A hunter finds issues, an adversary challenges them, and a referee judges -- so only real problems survive. |
| **[humanizer](./humanizer)** | Rewrites AI-generated text to read like a human wrote it. Detects and removes 40+ AI writing patterns (significance inflation, synonym cycling, em dash abuse, etc.). |
| **[graphite](./graphite)** | Manages stacked PRs through the [Graphite](https://graphite.dev) CLI. Handles branch creation, PR submission, merging, syncing, and restacking. |
| **[cracked-mode](./cracked-mode)** | Parallel task orchestration. Claude becomes a project manager that delegates all implementation to parallel sub-agents, maximizing throughput. |
| **[startup-namer](./startup-namer)** | Generates 20 startup name candidates at a time and validates each against domain availability, trademarks, SEO viability, and brand strength. |
| **[model-quantization](./model-quantization)** | Cross-platform model quantization and format conversion. Covers AWQ, GPTQ, GGUF, INT8, and guides you through HuggingFace/ONNX/CoreML/ExecuTorch pipelines with mobile memory/performance estimates. |
| **[coreml-optimization](./coreml-optimization)** | Deep guide for CoreML and Apple Neural Engine optimization. Covers ANE-friendly architecture patterns, split einsum attention, coremltools quantization (palettization, INT4), stateful KV cache models, and profiling. |
| **[android-acceleration](./android-acceleration)** | Hardware-accelerated AI inference on Android. Covers ExecuTorch, Qualcomm QNN (Hexagon NPU), MediaTek NeuroPilot, Samsung Exynos NPU, LiteRT, and XNNPACK CPU fallback across the fragmented Android NPU landscape. |
| **[ios-debugging](./ios-debugging)** | iOS simulator debugging via deep links, accessibility tree inspection, and log streaming. Covers `xcrun simctl`, idb tools, GPS spoofing, push testing, and hot reload vs rebuild decisions. |
| **[assets](./assets)** | AI-powered asset generation for images, music, sound effects, and video using APIs like ElevenLabs and others. Includes ready-to-run generation scripts. |

## Installation

### Install a single skill

```bash
# Clone the repo
git clone https://github.com/yocontra/skills.git

# Copy a skill folder into your Claude Code skills directory
cp -r skills/bug-audit ~/.claude/skills/bug-audit
```

### Install all skills

```bash
git clone https://github.com/yocontra/skills.git
cp -r skills/bug-audit ~/.claude/skills/bug-audit
cp -r skills/perf-audit ~/.claude/skills/perf-audit
cp -r skills/humanizer ~/.claude/skills/humanizer
cp -r skills/graphite ~/.claude/skills/graphite
cp -r skills/cracked-mode ~/.claude/skills/cracked-mode
cp -r skills/startup-namer ~/.claude/skills/startup-namer
cp -r skills/model-quantization ~/.claude/skills/model-quantization
cp -r skills/coreml-optimization ~/.claude/skills/coreml-optimization
cp -r skills/android-acceleration ~/.claude/skills/android-acceleration
cp -r skills/ios-debugging ~/.claude/skills/ios-debugging
cp -r skills/assets ~/.claude/skills/assets
```

### Verify installation

Open Claude Code and type `/` -- you should see your installed skills in the autocomplete list.

## Usage

Each skill is triggered either by slash command or by natural language:

```
/bug-audit                     # Run a full bug audit on the current project
/perf-audit git diff           # Audit performance of recent changes
/humanizer [paste text]        # Rewrite AI-sounding text
/graphite create               # Create a new stacked PR
/cracked-mode                  # Enter parallel orchestration mode
/startup-namer                 # Start brainstorming startup names
/model-quantization            # Quantize a model for mobile deployment
/coreml-optimization           # Optimize a model for Apple Neural Engine
/android-acceleration          # Deploy a model to Android NPUs
/ios-debugging                 # Debug an iOS app in the simulator
/assets                        # Generate images, music, or sound effects with AI
```

You can also just describe what you want and Claude will activate the right skill:

- "audit this project for bugs"
- "find performance issues in the map rendering pipeline"
- "make this text sound more human"
- "open a PR for this change"
- "go cracked"
- "help me name my startup"
- "quantize this model to 4-bit for mobile"
- "optimize this model for ANE"
- "deploy this model to Android with ExecuTorch"
- "debug this on the iOS simulator"
- "generate a sound effect for a button click"

## Recommended Plugins

These aren't required but pair well with these skills. Install via `/plugins` in Claude Code or add to your `~/.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "code-simplifier@claude-plugins-official": true,
    "context-mode@claude-context-mode": true,
    "context7@claude-plugins-official": true,
    "skill-creator@claude-plugins-official": true
  }
}
```

| Plugin | What it does |
|--------|-------------|
| **code-simplifier** | Run `/simplify` after writing code to clean it up for clarity, consistency, and maintainability without changing behavior. |
| **context-mode** | Processes large outputs (logs, build output, JSON) in a sandbox so they don't blow up your context window. |
| **context7** | Fetches live documentation for libraries and frameworks so Claude uses current APIs instead of stale training data. |
| **skill-creator** | Create new skills, modify existing ones, and run evals to test them. Useful if you want to fork and customize these skills. |

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI, desktop app, or IDE extension
- **graphite** requires the [Graphite CLI](https://graphite.dev/docs/installing-the-cli) (`gt`)
- **startup-namer** requires web access for domain/trademark lookups

## License

[MIT](./LICENSE)
