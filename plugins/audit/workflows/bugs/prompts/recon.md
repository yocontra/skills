# Recon: map the codebase for an adversarial bug audit

You are mapping a codebase so the downstream hunters know exactly what is in scope and where to look.

## What to do

1. **Identify structure** — read build files, entry points, and the top-level directory layout.
2. **List all in-scope source files** — `Glob` for the relevant extensions and enumerate them.
3. **Identify natural boundaries** — packages, modules, features, user flows.
4. **Note testing gaps** — areas with low or no test coverage are priority targets for hunters.

## Output (structured)

- `summary` — the recon context downstream hunters will rely on. Be concrete: what is this project, what are its main subsystems, what languages/frameworks, what should hunters prioritize.
- `files` — every in-scope source file (paths only).
- Put the natural module and feature boundaries in `summary` too. The schema has no separate field for them, and the engine zones files round-robin, so the summary is how hunters learn them.
- `highRisk` (optional) — files to prioritize when the orchestrator is doing a triage pass.

## Triage variant

If the orchestrator asks for a triage pass, read the first ~50 lines of each provided file and classify risk. Return only the high-risk files in `highRisk`. Use `summary` to explain what made those files high-risk.
