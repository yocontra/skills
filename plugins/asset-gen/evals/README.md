# asset-gen plugin evals

Behavioral tests for the `asset-gen` plugin, run with
[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). They check behavior,
not file syntax — use `claude plugin validate` for the latter.

## Run

```bash
# From the repo root. One run, no baseline: the cheap inner loop
scripts/run-evals.sh asset-gen --runs 1 --ablation none

# Routing only
scripts/run-evals.sh asset-gen --tag routing --runs 1 --ablation none

# Full two-arm run with the no-plugin baseline
scripts/run-evals.sh asset-gen
```

Every run writes `evals/results/<timestamp>/report.html`. That directory is gitignored.

## Cases

Each of the six skills (`image`, `svg`, `sound`, `music`, `video`, `3d-model`) is named
by at least one `tool_used: Skill` grader.

| Case | Asserts |
|------|---------|
| `transparent-sprite-routing` | A transparent game sprite request loads `image` and uses green-screen generation plus ImageMagick chroma key, not model-native transparency. Not yet measured. |
| `api-key-from-env` | A raster app icon loads `image`, not `svg`; with no key configured, the answer points to `GOOGLE_API_KEY` in the environment and never asks for the key in chat or hard-codes it. Not yet measured. |
| `svg-icon-cleanup` | Cleanup: loads `svg`; the pipeline keeps the raw PNG, bitmap, and traced SVG in a `mktemp -d` directory and removes it, writing only the final SVG into the project. Not yet measured. |
| `exclusion-vector-logo-not-image` | A scalable, CSS-recolorable vector logo loads `svg` and `image` must not fire; the logo is traced with potrace and themeable. Not yet measured. |
| `ui-sounds-oblique` | "Our app feels dead, make a tap sound and calm music" loads `sound` and keeps durations inside the ElevenLabs ranges (sound 0.5–30 s, music 3–600 s). Not yet measured. |
| `music-routing` | A looping, vocal-free menu track loads `music` with an in-range duration and `--instrumental`. Not yet measured. |
| `video-routing` | An 8 s vertical social clip loads `video`, picks a Veo 3.1 model at a supported duration and 9:16, and treats the job as long-running. Not yet measured. |
| `3d-model-routing` | A game prop request loads `3d-model`, produces a GLB through Meshy with polling, and tracks credits. Not yet measured. |
| `meshy-pipeline-knowledge` | Knowledge (`3d-model`): the Meshy flow is preview → refine (PBR) → remesh to quad GLB, polled asynchronously. Not yet measured. |
| `negative-css-gradient` | A CSS gradient request fires no skill and still gets correct CSS. Not yet measured. |

## Sandbox constraints these cases are written around

A run gets a throwaway HOME and an empty working directory with only this plugin loaded.
`Bash`, `Write`, `Edit`, `WebFetch`, and `WebSearch` are not granted. Each case
carries the standard `append_system_prompt` so a missing shell does not stall the answer.

No network and no API keys reach a run, so no case can generate a real file. The cases
grade the approach the response lays out: which generator and settings it picks, how it
post-processes, and how it handles keys. The `api-key-from-env` case leans into the
missing-key state the sandbox already has.

## Adding a case

One directory per case, holding `prompt.md` (frontmatter = case config, body = the prompt)
and a `graders/` directory with one `.md` per grader. Keep at least one non-Skill grader on
every case, or a two-arm run scores it on nothing.
