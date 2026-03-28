---
name: assets
description: |
  AI asset generation for images, sound effects, music, video, SVGs, and 3D models.
  Use when generating visual, audio, or 3D assets using AI APIs (Google Gemini, ElevenLabs, Meshy AI).
user-invocable: true
argument-hint: "[type: image | sound | music | video | svg | 3d] [prompt or options]"
allowed-tools: Bash, Read, Write, WebFetch
---

# AI Asset Generation

Generate images, sound effects, music, video, SVGs, and 3D models using AI APIs.

## Quick Reference

```bash
# Image (Google Gemini)
bun run scripts/generate-image.ts <output.png> "<prompt>" [--size WxH] [--quality 1-100] [--ref input.png]

# Sound effect (ElevenLabs, 0.5-22 seconds)
bun run scripts/generate-sound-effect.ts <output.mp3> <duration> "<prompt>"

# Music (ElevenLabs, 1-300 seconds)
bun run scripts/generate-music.ts <output.mp3> <duration> "<prompt>"

# Video (ElevenLabs Studio — requires access request)
bun run scripts/generate-video.ts <output.mp4> <duration> "<prompt>" [--model <model>]

# SVG (generate PNG then trace — see SVG section below)

# 3D Model (Meshy AI — see 3D Models section below)
```

**Scripts directory:** `scripts/` (relative to this skill's install location)

---

## Setup

### Required API Keys

Set these as environment variables (e.g. in `.env` or export in your shell):

```bash
# Image generation (Google Gemini)
GOOGLE_API_KEY=your_google_api_key

# Audio generation (ElevenLabs)
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Video generation (ElevenLabs Studio — by request only)
ELEVENLABS_STUDIO_API_KEY=your_studio_api_key

# 3D model generation (Meshy AI)
MESHY_API_KEY=your_meshy_api_key
```

### Dependencies

Scripts require [Bun](https://bun.sh) and a few npm packages:

```bash
bun add -d @google/genai sharp  # for image generation
```

For SVG tracing, install [potrace](https://potrace.sourceforge.net/) and [ImageMagick](https://imagemagick.org/):

```bash
brew install potrace imagemagick  # macOS
```

---

## Images

Uses Google Gemini image generation.

```bash
bun run scripts/generate-image.ts <output.png> "<prompt>" [options]
```

### Options

| Option          | Description                                |
| --------------- | ------------------------------------------ |
| --size WxH      | Output dimensions (e.g., 1024x1024)        |
| --size preset   | Use a preset (icon, splash, square, etc.)  |
| --quality 1-100 | Output quality percentage (default 90)     |
| --ref image.png | Reference image for edits/transformations  |
| --flash         | Use faster gemini-2.5-flash model          |

### Size Presets

| Preset        | Dimensions | Use Case            |
| ------------- | ---------- | ------------------- |
| icon          | 1024x1024  | App icon            |
| adaptive-icon | 1024x1024  | Android adaptive    |
| favicon       | 120x120    | Web favicon         |
| splash        | 1242x2436  | Splash screen       |
| thumbnail     | 400x400    | Small previews      |
| card          | 800x600    | Card images         |
| banner        | 1200x400   | Banner images       |
| square        | 512x512    | General square      |
| 2k            | 2048x2048  | High-res square     |
| 4k            | 4096x4096  | Ultra high-res      |

### Examples

```bash
# App icon
bun run scripts/generate-image.ts ./icon.png --size icon "Minimalist logo, clean geometric design, white on black"

# Background scene
bun run scripts/generate-image.ts ./bg.png --size 2k "Mountain landscape at sunset, painterly digital illustration"

# Edit an existing image
bun run scripts/generate-image.ts ./edited.png --ref ./original.png "Make the sky more dramatic"

# Fast generation with flash model
bun run scripts/generate-image.ts ./quick.png --flash "Abstract gradient pattern"
```

### DPR Tip

For retina/high-DPI displays, generate at 2x the logical dimensions. A 430x932 logical screen needs 860x1864 actual pixels.

---

## Image Verification & Fixing

Generated images often have unwanted padding. Verify and fix with ImageMagick.

```bash
# Check dimensions
magick IMAGE.png -format "%wx%h" info:

# Check for transparent padding (compare file size vs content size)
dims=$(magick IMAGE.png -format "%wx%h" info:)
trimmed=$(magick IMAGE.png -fuzz 0% -trim -format "%wx%h" info:)
echo "File: $dims, Content: $trimmed"

# Fix: trim padding and resize to fill target
magick IMAGE.png -trim +repage -resize 512x512^ -gravity center -extent 512x512 IMAGE.png
```

---

## Green Screen Chroma Key (Transparent Assets)

AI image generators struggle with true transparency. Generate on bright green, then remove it.

### Generate on green screen

Include these in your prompt:
- `on a SOLID BRIGHT GREEN (#00FF00) chroma key background`
- `clean edges, no green spill on subject`

### Remove green background

```bash
# Chroma key + optional resize
magick /tmp/raw.png \
  -fuzz 25% -transparent "#00FF00" \
  -channel alpha -morphology Erode Diamond:1 +channel \
  -trim +repage \
  -resize 512x512^ -gravity center -extent 512x512 \
  output.png

# Verify transparency
magick output.png -format "%[channels]" info:
# Should output: srgba
```

### Fuzz Tolerance

| Fuzz % | Use Case                               |
| ------ | -------------------------------------- |
| 15%    | Clean studio-quality green screens     |
| 25%    | Most AI-generated images (recommended) |
| 35%    | Heavy green spill, soft/blurry edges   |
| 45%+   | Last resort — will eat into colors     |

### Edge Cleanup

`Erode Diamond:1` shrinks alpha by 1px, removing green fringe. Increase for more cleanup:

```bash
-channel alpha -morphology Erode Diamond:1 +channel  # Light (1px)
-channel alpha -morphology Erode Diamond:2 +channel  # Medium (2px)
-channel alpha -morphology Erode Diamond:3 +channel  # Heavy (3px)
```

---

## Sound Effects

Uses ElevenLabs sound generation API.

```bash
bun run scripts/generate-sound-effect.ts <output.mp3> <duration> "<prompt>"
```

| Param    | Description              | Range    |
| -------- | ------------------------ | -------- |
| output   | File path (.mp3)         | -        |
| duration | Length in seconds         | 0.5 - 22 |
| prompt   | Description of the sound | Text     |

### Examples

```bash
# UI sound
bun run scripts/generate-sound-effect.ts ./click.mp3 0.3 "Crisp button click, subtle and satisfying"

# Ambient loop
bun run scripts/generate-sound-effect.ts ./wind.mp3 15 "Gentle wind through trees, seamless loop, nature ambient"

# Notification
bun run scripts/generate-sound-effect.ts ./notify.mp3 0.8 "Pleasant notification chime, warm and clear"
```

---

## Music

Uses ElevenLabs music generation API.

```bash
bun run scripts/generate-music.ts <output.mp3> <duration> "<prompt>"
```

| Param    | Description              | Range   |
| -------- | ------------------------ | ------- |
| output   | File path (.mp3)         | -       |
| duration | Length in seconds         | 1 - 300 |
| prompt   | Description of the music | Text    |

### Examples

```bash
# Background music
bun run scripts/generate-music.ts ./bg-music.mp3 120 "Lo-fi chill hop, relaxed atmosphere, no vocals, loopable"

# Short jingle
bun run scripts/generate-music.ts ./jingle.mp3 15 "Upbeat success jingle, bright and celebratory"

# Ambient soundscape
bun run scripts/generate-music.ts ./ambient.mp3 180 "Deep ambient soundscape, ethereal pads, slow evolution"
```

---

## Video

Uses ElevenLabs Studio API (requires access request — contact https://elevenlabs.io/contact-sales).

```bash
bun run scripts/generate-video.ts <output.mp4> <duration> "<prompt>" [--model <model>]
```

### Available Models

| Model          | Description              |
| -------------- | ------------------------ |
| sora-2-pro     | OpenAI Sora 2 Pro (best) |
| sora-2         | OpenAI Sora 2            |
| veo-3.1        | Google Veo 3.1           |
| veo-3.1-fast   | Google Veo 3.1 Fast      |
| veo-3          | Google Veo 3 (default)   |
| kling-2.5      | Kling 2.5                |
| seedance-1-pro | Seedance 1 Pro           |
| wan-2.5        | Wan 2.5                  |

### Examples

```bash
# Nature scene
bun run scripts/generate-video.ts ./nature.mp4 5 "Fog rolling through a forest at dawn, cinematic" --model veo-3.1

# Product showcase
bun run scripts/generate-video.ts ./product.mp4 4 "Sleek device rotating on dark background, studio lighting" --model sora-2-pro
```

---

## SVG Icons

Generate a PNG, then trace to SVG for scalable icons.

### Pipeline

```bash
# 1. Generate a high-contrast PNG
bun run scripts/generate-image.ts /tmp/icon-raw.png --size 1024x1024 \
  "Simple iconic [subject], flat design, centered, white silhouette on black background, no shadows, no gradients"

# 2. Prepare for tracing (threshold to pure black/white)
magick /tmp/icon-raw.png -background black -flatten -colorspace gray -threshold 50% -negate /tmp/icon-bw.png
magick /tmp/icon-bw.png /tmp/icon.pbm

# 3. Trace to SVG
potrace /tmp/icon.pbm -s -o /tmp/icon-traced.svg

# 4. Optimize
bunx svgo /tmp/icon-traced.svg -o ./icon.svg
```

### Make SVGs dynamic with currentColor

Edit the output SVG to use `currentColor` so it can be styled dynamically:

```xml
<!-- Change hardcoded fills to currentColor -->
<svg xmlns="..." width="128" height="128" viewBox="200 250 630 530" fill="currentColor">
  <path d="..."/>
</svg>
```

### Crop whitespace

Adjust the `viewBox` to remove excess padding:

```xml
<!-- Before: full canvas -->
<svg viewBox="0 0 1024 1024">

<!-- After: cropped to content -->
<svg viewBox="200 250 630 530">
```

---

## 3D Models

Uses **Meshy AI** (meshy.ai) to generate 3D models via REST API.

### Workflow

Every 3D model follows a 3-step pipeline:

```
1. Generate  →  Text-to-3D preview (untextured mesh)
2. Texture   →  Refine with baked textures
3. Remesh    →  Optimize topology, export as GLB
```

Cost: ~35 credits per model (20 preview + 10 refine + 5 remesh).

### Step 1: Generate (Preview)

```bash
curl -s -X POST "https://api.meshy.ai/openapi/v2/text-to-3d" \
  -H "Authorization: Bearer $MESHY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "preview",
    "prompt": "Your prompt here",
    "ai_model": "meshy-6",
    "symmetry_mode": "auto"
  }'
# Returns: {"result": "<task-id>"}
```

| Parameter     | Value       | Notes                                  |
| ------------- | ----------- | -------------------------------------- |
| mode          | `"preview"` | Required first step                    |
| ai_model      | `"meshy-6"` | Always use latest model                |
| symmetry_mode | `"auto"`    | `"on"` for perfectly symmetric objects |
| pose_mode     | `"t-pose"`  | Required for humanoid characters       |

### Step 2: Texture (Refine)

```bash
curl -s -X POST "https://api.meshy.ai/openapi/v2/text-to-3d" \
  -H "Authorization: Bearer $MESHY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "refine",
    "preview_task_id": "<preview-task-id>",
    "enable_pbr": true
  }'
```

Set `enable_pbr: true` for PBR materials (metallic, roughness, normal maps) or `false` for baked base-color-only textures.

### Step 3: Remesh & Export

```bash
curl -s -X POST "https://api.meshy.ai/openapi/v1/remesh" \
  -H "Authorization: Bearer $MESHY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input_task_id": "<refine-task-id>",
    "target_formats": ["glb"],
    "topology": "quad",
    "target_polycount": 30000
  }'
```

| Parameter        | Value     | Notes                             |
| ---------------- | --------- | --------------------------------- |
| target_formats   | `["glb"]` | Single binary, embedded textures  |
| topology         | `"quad"`  | Clean quads, good for editing     |
| target_polycount | `30000`   | Adjust for your platform's budget |

### Polling for Completion

All Meshy tasks are async. Poll until `status` is `SUCCEEDED` or `FAILED`:

```bash
# Poll text-to-3d tasks
curl -s "https://api.meshy.ai/openapi/v2/text-to-3d/<task-id>" \
  -H "Authorization: Bearer $MESHY_API_KEY"

# Poll remesh tasks
curl -s "https://api.meshy.ai/openapi/v1/remesh/<task-id>" \
  -H "Authorization: Bearer $MESHY_API_KEY"
```

Typical times: preview ~60s, refine ~90s, remesh ~60s. Response includes `model_urls.glb` when complete.

### Download the Final Model

```bash
curl -sL -o ./model.glb "<model_urls.glb URL from completed task>"
```

### Image-to-3D (Alternative)

Use when you have a reference image:

```bash
curl -s -X POST "https://api.meshy.ai/openapi/v1/image-to-3d" \
  -H "Authorization: Bearer $MESHY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "<public-url-or-data-uri>",
    "ai_model": "meshy-6",
    "should_remesh": true,
    "topology": "quad",
    "target_polycount": 30000,
    "should_texture": true,
    "enable_pbr": true
  }'
```

Combines generation + texturing + remeshing in one step. Input image should have a clean subject on a plain background (Meshy handles background removal).

### Check Balance

```bash
curl -s "https://api.meshy.ai/openapi/v1/balance" \
  -H "Authorization: Bearer $MESHY_API_KEY"
```

### Prompting Guide

**Structure:** `[Subject], [Material/Style], [Details], [Setting/Context]`

Max 600 characters. Be specific and visual.

**Do:**
- Describe a single, specific object
- Include material keywords: brass, copper, leather, wood, stone, marble, ceramic, glass
- Include style keywords: Victorian, antique, weathered, ornate, steampunk, gothic, modern, minimalist
- Keep to 3-5 key descriptors
- For characters: include "T-pose" and "full body"

**Don't:**
- Describe full scenes or multiple objects
- Use abstract concepts: "magical energy", "glowing aura"
- Use subjective words: "beautiful", "amazing"
- Overload with adjectives (diminishing returns past 5)

### Full Pipeline Example

```bash
# 1. Preview
PREVIEW_ID=$(curl -s -X POST "https://api.meshy.ai/openapi/v2/text-to-3d" \
  -H "Authorization: Bearer $MESHY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "preview",
    "prompt": "A weathered leather briefcase with brass clasps and buckles, vintage patina",
    "ai_model": "meshy-6",
    "symmetry_mode": "auto"
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['result'])")
echo "Preview: $PREVIEW_ID"

# 2. Poll preview (~60s), then refine
REFINE_ID=$(curl -s -X POST "https://api.meshy.ai/openapi/v2/text-to-3d" \
  -H "Authorization: Bearer $MESHY_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"mode\": \"refine\",
    \"preview_task_id\": \"$PREVIEW_ID\",
    \"enable_pbr\": true
  }" | python3 -c "import sys,json; print(json.load(sys.stdin)['result'])")
echo "Refine: $REFINE_ID"

# 3. Poll refine (~90s), then remesh
REMESH_ID=$(curl -s -X POST "https://api.meshy.ai/openapi/v1/remesh" \
  -H "Authorization: Bearer $MESHY_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"input_task_id\": \"$REFINE_ID\",
    \"target_formats\": [\"glb\"],
    \"topology\": \"quad\",
    \"target_polycount\": 30000
  }" | python3 -c "import sys,json; print(json.load(sys.stdin)['result'])")
echo "Remesh: $REMESH_ID"

# 4. Poll remesh (~60s), then download
# GLB_URL=$(curl -s "https://api.meshy.ai/openapi/v1/remesh/$REMESH_ID" \
#   -H "Authorization: Bearer $MESHY_API_KEY" \
#   | python3 -c "import sys,json; print(json.load(sys.stdin)['model_urls']['glb'])")
# curl -sL -o ./briefcase.glb "$GLB_URL"
```

---

## Tips

1. **Iterate on prompts** — first generations are rarely perfect. Refine and regenerate.
2. **Be specific** — include style, mood, colors, and what NOT to include.
3. **Check dimensions** — verify output size matches your needs.
4. **Test in context** — assets should feel cohesive when used together.
5. **Batch when possible** — run multiple generation scripts in parallel.
