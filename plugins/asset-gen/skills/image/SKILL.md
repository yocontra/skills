---
name: image
effort: medium
description: Generate raster images (PNG, JPG, WebP) with Google Gemini for app icons, favicons, splash screens, UI or game art, transparent sprites, album art, and marketing visuals, or edit an existing image. Vector or SVG icons and logos go to svg.
argument-hint: "[out.png] [prompt] [--size WxH|preset]"
allowed-tools: Bash, Read, Write
---

$ARGUMENTS

# Raster images with Gemini

Follow the [generation workflow](../../shared/workflow.md) and run the
[first-use setup](../../shared/setup.md) (key: `GOOGLE_API_KEY`).

## Command

```bash
bun run "${CLAUDE_PLUGIN_ROOT}/scripts/generate-image.ts" <out.png> "<prompt>" [--size WxH|preset] [--quality 1-100] [--ref in.png] [--model <id>]
```

The default model is `gemini-3.1-flash-image` (Nano Banana 2). With `--size`, the
script asks the model for the nearest supported aspect ratio and a 1K, 2K, or 4K
image, then `sharp` crops and resizes to the exact size. Output format follows the
file extension (`.png`, `.jpg`, `.webp`).

| Option | Meaning |
|---|---|
| `--size WxH` | Output dimensions, e.g. `1024x1024` |
| `--size <preset>` | One of the presets below |
| `--quality 1-100` | Output quality, default 90 |
| `--ref <image>` | Reference image for edits or transformations ("make the sky more dramatic") |
| `--model <id>` | Another Gemini image model, e.g. `gemini-nano-banana-2.1` or `gemini-3-pro-image` |

| Preset | Dimensions | Use |
|---|---|---|
| `icon` | 1024x1024 | App icon |
| `adaptive-icon` | 1024x1024 | Android adaptive icon |
| `favicon` | 120x120 | Web favicon |
| `splash` | 1242x2436 | Splash screen |
| `thumbnail` | 400x400 | Small previews |
| `card` | 800x600 | Card images |
| `banner` | 1200x400 | Banners |
| `square` | 512x512 | General square |
| `2k` | 2048x2048 | High-res square |
| `4k` | 4096x4096 | Ultra high-res |

```bash
S="${CLAUDE_PLUGIN_ROOT}/scripts"
bun run "$S/generate-image.ts" ./icon.png --size icon "Minimalist logo, clean geometric design, white on black"
bun run "$S/generate-image.ts" ./bg.png --size 2k "Mountain landscape at sunset, painterly digital illustration"
bun run "$S/generate-image.ts" ./edited.png --ref ./original.png "Make the sky more dramatic"
```

Retina and other high-DPI screens need 2x the logical size: a 430x932 logical screen
needs 860x1864 px.

Checks and fixes need ImageMagick (`magick`). If it is missing, install it with
`brew install imagemagick` on macOS or the distro package elsewhere, then continue.

## Inspect and fix

Check dimensions and padding, then read the image back to judge whether it matches
the request. Image models add padding; when the content does not fill the frame,
trim and resize:

```bash
magick IMAGE.png -format "%wx%h" info:                       # dimensions

dims=$(magick IMAGE.png -format "%wx%h" info:)                # padding: canvas vs content
trimmed=$(magick IMAGE.png -fuzz 0% -trim -format "%wx%h" info:)
echo "File: $dims, Content: $trimmed"

magick IMAGE.png -trim +repage -resize 512x512^ -gravity center -extent 512x512 IMAGE.png
```

## Transparent assets via green screen

Image models cannot produce real transparency. Generate on bright green and key it
out. Add to the prompt:

- `on a solid bright green (#00FF00) chroma key background`
- `clean edges, no green spill on subject`

Generate `raw.png` into a `mktemp -d` directory, key it into the project, and delete
the temp directory once the keyed file is written:

```bash
magick "$T/raw.png" \
  -fuzz 25% -transparent "#00FF00" \
  -channel alpha -morphology Erode Diamond:1 +channel \
  -trim +repage \
  -resize 512x512^ -gravity center -extent 512x512 \
  output.png

magick output.png -format "%[channels]" info:   # expect: srgba
```

| Fuzz | When |
|---|---|
| 15% | Clean, studio-quality green |
| 25% | Most AI-generated images (start here) |
| 35% | Heavy spill, soft or blurry edges |
| 45%+ | Last resort; starts eating subject colors |

`Erode Diamond:N` shrinks alpha by N px to remove green fringe: `Diamond:1` is light,
`Diamond:2` medium, `Diamond:3` heavy (`-channel alpha -morphology Erode Diamond:N +channel`).
