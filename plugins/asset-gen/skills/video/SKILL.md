---
name: video
effort: medium
description: Generate video clips with ElevenLabs Flows (Google Veo 3.1, ByteDance Seedance) for app intros, product shots, cinematic b-roll, and social clips. Needs an ElevenLabs Pro plan with Image & Video access.
argument-hint: "[out.mp4] [seconds] [prompt] [--model] [--aspect] [--resolution]"
allowed-tools: Bash, Read, Write
---

$ARGUMENTS

# Video with ElevenLabs Flows

Follow the [generation workflow](../../shared/workflow.md) and run the
[first-use setup](../../shared/setup.md) (key: `ELEVENLABS_API_KEY`).

## Command

ElevenLabs Image & Video API: `POST /v1/flows/video`, then polled at
`GET /v1/flows/video/{id}` every 10 s until `completed` or `failed`; the script
downloads the MP4 from `content_url`. It needs a Pro plan or above (a 402
`paid_plan_required` otherwise) and a key with the Image & Video permission. Any 401,
402, or 403 from this endpoint means the plan or key lacks Image & Video access:
report that rather than retrying. Failed generations are not charged.

```bash
bun run "${CLAUDE_PLUGIN_ROOT}/scripts/generate-video.ts" <output.mp4> <duration> "<prompt>" [--model <model>] [--aspect 16:9|9:16] [--resolution 720p|1080p|4K]
```

| Model | Duration | Notes |
|---|---|---|
| `veo-3.1-fast-generate-001` | 4, 6, 8 s | Google Veo 3.1 Fast, the default |
| `veo-3.1-generate-001` | 4, 6, 8 s | Google Veo 3.1, best quality |
| `bytedance-seedance-v2` | whole seconds, default 5 | Needs model approval from ElevenLabs |
| `bytedance-seedance-v2-fast` | whole seconds, default 5 | Needs model approval from ElevenLabs |

Veo takes `--aspect 16:9` (default) or `9:16` and `--resolution 720p` (default),
`1080p`, or `4K`. Audio is generated with the video by default.

```bash
S="${CLAUDE_PLUGIN_ROOT}/scripts"
bun run "$S/generate-video.ts" ./nature.mp4 8 "Fog rolling through a forest at dawn, cinematic" --model veo-3.1-generate-001
bun run "$S/generate-video.ts" ./product.mp4 4 "Sleek device rotating on dark background, studio lighting" --resolution 1080p
```

A generation takes minutes; run the script with `run_in_background` and keep working
on other assets meanwhile.
