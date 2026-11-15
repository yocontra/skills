# skills

Claude Code plugins for adversarial code audits, GitHub PR workflows, spec-driven
planning, SRE, engineering management, on-device ML, security research, and asset
generation. Every skill acts and then reports instead of stopping for approval,
stays inside a description and body budget, and ships with a behavioral eval suite.

They work in Claude Code as plugins, and in Codex, OpenCode, pi, omp, and other
[Agent Skills](https://agentskills.io) harnesses as plain skill directories.

## Install

### Claude Code

```bash
/plugin marketplace add yocontra/skills
/plugin install audit@skills          # or any plugin below
```

To give everyone on a project the same plugins, commit a `.claude/settings.json`.
Claude Code offers to add the marketplace and install the plugins when a teammate
trusts the folder:

```jsonc
// .claude/settings.json
{
  "extraKnownMarketplaces": {
    "skills": { "source": { "source": "github", "repo": "yocontra/skills" } }
  },
  "enabledPlugins": {
    "audit@skills": true,
    "gh@skills": true,
    "refine@skills": true
  }
}
```

[This repo's own `.claude/settings.json`](.claude/settings.json) enables every plugin.

### Codex, OpenCode, pi, omp, and other harnesses

These read plain skill directories, so `scripts/flatten-skills.py` turns each plugin
skill into a self-contained directory (named `<plugin>-<skill>`, e.g. `audit-bugs`,
`gh-review`) with its scripts and workflow paths resolved, and links them in:

```bash
git clone https://github.com/yocontra/skills && cd skills
python3 scripts/flatten-skills.py --link codex,agents,opencode
```

Targets: `codex` (`~/.codex/skills`), `agents` (`~/.agents/skills`, read by omp and
other Agent Skills tools), `opencode` (`~/.config/opencode/skills`), `claude`
(`~/.claude/skills`, if you prefer flat skills to plugins). For pi, point
`~/.pi/agent/skills` at the output directory (`~/.local/share/agent-skills/skills`).
Re-run it after `git pull`; it removes only what it created. Plugin hooks and slash
commands are Claude Code features and are not carried over.

## Plugins

### Code quality

| Plugin | Trigger | Description |
|--------|---------|-------------|
| [audit](plugins/audit/) | `/audit:bugs`, `/audit:performance`, `/audit:security`, `/audit:exhaustive` | Adversarial code auditing -- bugs, performance, and security via hunter/skeptic/referee agents sized to the target; `exhaustive` checks every item in a named set with a coverage proof |
| [refine](plugins/refine/) | `/refine:code-cleanup`, `/refine:simplify`, `/refine:freshen-docs` | Improve existing code & docs -- cleanup audits, simplification of changed code, stale-doc/comment sweeps |

### Planning and execution

| Plugin | Trigger | Description |
|--------|---------|-------------|
| [workflow](plugins/workflow/) | `/workflow:go-time`, an approved plan or OpenSpec change to ship; `/workflow:bug-bash`, a GitHub Issues backlog to triage | Execute approved work end to end — parallel implementers, sized self-review, E2E matrix, PR, CI and feedback, merge, cleanup. Bug bash triages issues with repro and skeptic agents, posts approved replies, and swarms go-time fixers. `/workflow:broadcast` sends a non-disruptive FYI to the other Claude sessions on this machine, grouped by repo |
| [openspec](plugins/openspec/) | "Propose a change", explore, apply, archive, "set up openspec", `/openspec:*` | OpenSpec spec-driven planning — propose, explore, apply, update, sync, and archive changes via the `openspec` CLI; `/openspec:setup` adopts it in a repo and migrates existing plans. Enable with `"openspec@skills": true` |

### GitHub and PRs

| Plugin | Trigger | Description |
|--------|---------|-------------|
| [gh](plugins/gh/) | PRs, reviews, checks, GitHub, worktrees | GitHub CLI — PRs, issues, CI checks, review comments, GraphQL, plus git worktrees for parallel agents |
| [graphite](plugins/graphite/) | `gt`, stacked PRs | Graphite CLI stacks — create, submit, restack, sync, merge, and work review feedback across a stack |

### Operations

| Plugin | Trigger | Description |
|--------|---------|-------------|
| [sre](plugins/sre/) | Outages, on-call, incidents, logs, errors, runbooks, PIR | Site reliability — PagerDuty, Sentry, Splunk, runbooks, RCA |

### Agent tooling

| Plugin | Trigger | Description |
|--------|---------|-------------|
| [agent-ready](plugins/agent-ready/) | New project, "make this repo agent-ready", first-time setup | `/agent-ready:uplift` audits a repo read-only (CLIs, auth, MCP servers, env vars, permissions, CI, test/lint/build commands), then applies the CLAUDE.md, settings, hooks and docs changes you approve |
| [agent-cost-report](plugins/agent-cost-report/) | Agent cost, token spend, cache rewrites | Claude Code spend report from local transcripts: subagent share, idle-gap cache rewrites by cause, tool errors, hook denials |
| [skill-improver](plugins/skill-improver/) | "Review my skill", SKILL.md or plugin audits | Reviews and fixes skills and plugins against this repo's budgets and anti-patterns; ships `lint-skill.mjs` |

### Status reporting

| Plugin | Trigger | Description |
|--------|---------|-------------|
| [status](plugins/status/) | `/status:standup`, `/status:weekly` | Daily standup and weekly management status from git commits and PRs |

### Management

| Plugin | Trigger | Description |
|--------|---------|-------------|
| [manager](plugins/manager/) | 1:1 prep, team pulse, retros, onboarding plans, self-review | Engineering-manager toolkit — prep-1on1 (any direction), team-pulse, retro, yearly-rollup, onboard-plan, self-review |

### Writing

| Plugin | Trigger | Description |
|--------|---------|-------------|
| [humanizer](plugins/humanizer/) | Writing, editing, prose, AI patterns | Writing guide for clearer prose — 33 readability habits with before/after examples |
| [startup-namer](plugins/startup-namer/) | Company, product, or app names | Batches of name candidates vetted for domains, WHOIS, USPTO trademarks, and SEO competition |

### Security

| Plugin | Trigger | Description |
|--------|---------|-------------|
| [security-pentest](plugins/security-pentest/) | Authorized live URL, API, or host | Black-box pentest with hunter/skeptic/referee agents re-testing every finding against the running target |
| [security-reverse](plugins/security-reverse/) | Binary, firmware, APK, .NET, JAR, Electron, .ipa, WASM | REA-first: decompile and trace attack surface with the REA MCP server, then audit the recovered code (manual Ghidra/JADX toolchain as fallback) |

### On-device ML and mobile

| Plugin | Trigger | Description |
|--------|---------|-------------|
| [coreml-optimization](plugins/coreml-optimization/) | Core ML, ANE, coremltools | Conversion, ANE placement, split einsum, palettization/INT4, stateful KV cache, Foundation Models |
| [model-quantization](plugins/model-quantization/) | AWQ, GPTQ, GGUF, ONNX, ExecuTorch | Cross-platform quantization and conversion, mobile memory budgeting, quality validation |
| [android-acceleration](plugins/android-acceleration/) | Android NPU/GPU inference | ExecuTorch (QNN, MediaTek, Exynos), LiteRT, ONNX Runtime Mobile, Gemini Nano, JNI bridges, profiling |
| [ios-debugging](plugins/ios-debugging/) | iOS simulator | simctl, deep links, idb accessibility tree, logs, location/push/status-bar overrides |

### Assets

| Plugin | Trigger | Description |
|--------|---------|-------------|
| [asset-gen](plugins/asset-gen/) | `/asset-gen:image`, `/asset-gen:svg`, `/asset-gen:sound`, `/asset-gen:music`, `/asset-gen:video`, `/asset-gen:3d-model` | One skill per asset type: raster images and sprites (Gemini), traced SVG icons, sound effects and music (ElevenLabs), video (ElevenLabs Flows: Veo, Seedance), and GLB models (Meshy). Keys come from env |

## Development

### OpenSpec sync

The openspec plugin's skills and commands are generated by the OpenSpec CLI at the version pinned in `plugins/openspec/openspec-version`. To regenerate them:

```bash
make sync-openspec
```

### Linting

```bash
make hooks        # Run all prek hooks (trailing whitespace, EOF, YAML, large files, merge conflict, private key, Vale prose lint)
```

### Prerequisites

- [uv](https://docs.astral.sh/uv/) -- Python package manager (runs the Python test suites)
- [prek](https://prek.j178.dev) -- Git hook framework (`cargo install prek`)

## Plugin structure

Each plugin follows this layout:

```
plugins/skill-name/
├── .claude-plugin/
│   └── plugin.json        — Plugin metadata (name, description, version, keywords)
└── skills/
    └── skill-name/
        ├── SKILL.md       — Core workflow and process (under 500 lines)
        └── references/    — Optional detailed reference docs
            └── topic.md   — Loaded on-demand when linked from SKILL.md
```

## Contributing

1. Create a new plugin directory under `plugins/` following the structure above
2. Keep SKILL.md under 500 lines -- use `references/` for detailed content, linked from the body
3. Include frontmatter with `name`, `description`, and `effort` in SKILL.md
4. Write the skill to act, then report: no approval gates, defaults over questions, and any follow-up questions batched after the draft. Ask only when the request is ambiguous in a way that changes the work, or before destroying data the task did not ask to destroy (see "Autonomy" in [CLAUDE.md](CLAUDE.md))
5. Add plugin.json with name, description, version, author, keywords, and skills path
6. Add an entry to `.claude-plugin/marketplace.json`
7. Add an eval suite under `plugins/<plugin>/evals/` (see the `plugin-evals` skill)
8. Run `make pre-commit` to verify the lint, workflow, eval, and cost checks pass
9. Test the plugin by installing it locally
10. Open a PR

## License

MIT; see [LICENSE](LICENSE). The openspec and humanizer plugins build on MIT-licensed upstream work; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
