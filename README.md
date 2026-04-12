# Skills

A collection of personal [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugins I use daily. Each one is a standalone plugin with a `.claude-plugin/plugin.json` manifest and one or more skills inside.

## Plugins

### Code Quality & Security

| Plugin | Slash Command | What it does |
|--------|--------------|--------------|
| **[bug-audit](./bug-audit)** | `/bug-audit` | Hunts bugs using adversarial hunter/skeptic/referee trios in parallel. Catches logic errors, race conditions, and edge cases. |
| **[perf-audit](./perf-audit)** | `/perf-audit` | Same adversarial trio structure, but focused on performance: slow queries, memory leaks, N+1s, scalability bottlenecks. |
| **[exploit-finder](./exploit-finder)** | `/exploit-finder` | Three-role adversarial security audit: finders hunt bugs, disprovers try to kill findings, referees make the final call. White-box and black-box modes. |
| **[code-simplify](./code-simplify)** | `/code-simplify` | Reviews recent code changes and cleans up reuse, quality, and efficiency problems. |
| **[exhaustive-search](./exhaustive-search)** | `/exhaustive-search` | Searches an entire space with parallel agent teams. Every item gets checked, no sampling, no skipping. |

### Planning & Workflow

| Plugin | Slash Command | What it does |
|--------|--------------|--------------|
| **[deep-planner](./deep-planner)** | `/deep-planner` | Plans and executes large implementation tasks across multiple agents, with numbered plan files and research/review phases. |
| **[dev-workflow](./dev-workflow)** | `/dev-workflow` | Full feature lifecycle from requirements through merge. Plans, implements with parallel agents, reviews, audits, and opens the PR. |
| **[worktree-manager](./worktree-manager)** | `/worktree-manager` | Git worktree manager that lets multiple agents work on the same repo in parallel without stepping on each other. |
| **[graphite](./graphite)** | `/graphite` | Stacked PR workflow through the Graphite CLI. Create branches, submit PRs, merge, sync, and manage stacks with `gt`. |

### Writing & Text

| Plugin | Slash Command | What it does |
|--------|--------------|--------------|
| **[humanizer](./humanizer)** | `/humanizer` | Strips AI-generated writing patterns from text: inflated language, promotional filler, AI vocabulary, mechanical structure. |
| **[freshen](./freshen)** | `/freshen` | Finds stale comments, docstrings, TODOs, and docs, then fixes them. Parallel agents scan the codebase and correct inaccuracies. |

### Asset Generation

| Plugin | Slash Command | What it does |
|--------|--------------|--------------|
| **[asset-gen](./asset-gen)** | `/asset-gen` | Generates images, sound effects, music, video, SVGs, and 3D models via Gemini, ElevenLabs, and Meshy AI. |

### Mobile & On-Device ML

| Plugin | Slash Command | What it does |
|--------|--------------|--------------|
| **[model-quantization](./model-quantization)** | `/model-quantization` | Quantizes and converts models across formats and platforms: AWQ, GPTQ, GGUF, ONNX, CoreML, ExecuTorch. |
| **[coreml-optimization](./coreml-optimization)** | `/coreml-optimization` | Targets Apple's Neural Engine on iOS/macOS. Handles conversion, ANE layout, split einsum, and quantization. |
| **[android-acceleration](./android-acceleration)** | `/android-acceleration` | Runs AI models on Android hardware (NPUs, GPUs, DSPs) via ExecuTorch, QNN, NeuroPilot, LiteRT, ONNX Runtime Mobile. |
| **[ios-debugging](./ios-debugging)** | `/ios-debugging` | Works with iOS simulators: launch apps, navigate screens, inspect UI, read logs. Supports Expo, React Native, and native Swift. |

### Meta & Tooling

| Plugin | Slash Command | What it does |
|--------|--------------|--------------|
| **[gh-cli](./gh-cli)** | — | Routes GitHub operations through `gh` CLI instead of unauthenticated web fetches. |
| **[skill-improver](./skill-improver)** | `/skill-improver` | Reviews Claude Code skill files for structural issues, ambiguous instructions, and prompt anti-patterns. |

### Other

| Plugin | Slash Command | What it does |
|--------|--------------|--------------|
| **[startup-namer](./startup-namer)** | `/startup-namer` | Brainstorms startup names and checks viability: domain availability, trademark conflicts, SEO potential, WHOIS data. |

## Plugin Structure

Each plugin follows the same layout:

```
plugin-name/
  .claude-plugin/
    plugin.json          # manifest (name, description, version, author, skills)
  skills/
    skill-name/
      SKILL.md           # skill prompt and instructions
      references/        # optional reference docs
      scripts/           # optional helper scripts
```

## Installation

### Install a single plugin

```bash
git clone https://github.com/yocontra/skills.git
cp -r skills/bug-audit ~/.claude/plugins/bug-audit
```

### Install all plugins

```bash
git clone https://github.com/yocontra/skills.git
cd skills
for plugin in android-acceleration asset-gen bug-audit code-simplify coreml-optimization deep-planner dev-workflow exhaustive-search exploit-finder freshen gh-cli graphite humanizer ios-debugging model-quantization perf-audit skill-improver startup-namer worktree-manager; do
  cp -r "$plugin" ~/.claude/plugins/"$plugin"
done
```

### Verify

Open Claude Code and type `/` -- you should see your installed skills in the autocomplete list.

## Usage

Each skill is triggered by slash command or natural language:

```
/bug-audit                     # Full adversarial bug audit
/perf-audit                    # Hunt performance problems
/exploit-finder                # Find security vulnerabilities
/code-simplify                 # Clean up recent code changes
/exhaustive-search             # Exhaustive search of a space
/deep-planner                  # Plan a large implementation
/dev-workflow                  # Full feature lifecycle
/worktree-manager              # Manage parallel worktrees
/graphite create               # Create a stacked PR
/humanizer [text]              # Strip AI writing patterns
/freshen                       # Fix stale comments and docs
/asset-gen image [prompt]      # Generate an image
/model-quantization            # Quantize a model for mobile
/coreml-optimization           # Optimize for Apple Neural Engine
/android-acceleration          # Deploy to Android NPUs
/ios-debugging                 # Debug on iOS simulator
/startup-namer                 # Brainstorm startup names
/skill-improver [path]         # Review and improve a skill file
```

Or just describe what you want:

- "audit this project for bugs"
- "find performance issues in the rendering pipeline"
- "hunt for security vulnerabilities"
- "clean up my recent changes"
- "check every file for X"
- "plan out this feature"
- "take this from requirements to merged PR"
- "make this text sound more human"
- "fix stale comments in the codebase"
- "generate a sound effect for a button click"
- "quantize this model to 4-bit for mobile"
- "optimize this model for ANE"
- "debug this on the iOS simulator"
- "help me name my startup"

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI, desktop app, or IDE extension
- **graphite** requires the [Graphite CLI](https://graphite.dev/docs/installing-the-cli) (`gt`)
- **startup-namer** requires web access for domain/trademark lookups
- **asset-gen** requires API keys for Gemini, ElevenLabs, and/or Meshy AI
- **exploit-finder** black-box mode can use [Kali Linux in a container](./exploit-finder/skills/exploit-finder/reference/kali-container-setup.md) for nmap, metasploit, etc.
- **gh-cli** requires the [GitHub CLI](https://cli.github.com/) (`gh auth login`)

## License

[MIT](./LICENSE)
