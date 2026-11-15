---
name: svg
effort: medium
description: Generate vector SVG icons and logos by rendering a high-contrast silhouette with Gemini, tracing it with potrace, and optimizing with svgo, themeable via currentColor. Use for scalable, vector, or SVG icons, logos, and glyphs. Raster PNG or app-store icons go to image.
argument-hint: "[out.svg] [subject]"
allowed-tools: Bash, Read, Write
---

$ARGUMENTS

# SVG icons and logos

Follow the [generation workflow](../../shared/workflow.md) and run the
[first-use setup](../../shared/setup.md) (key: `GOOGLE_API_KEY`).

The pipeline needs ImageMagick (`magick`) and potrace. If either is missing, install
with `brew install imagemagick potrace` on macOS or the distro package elsewhere,
then continue. `svgo` runs through `bunx`.

## Pipeline

Generate a high-contrast PNG, threshold it, trace it to vector, and optimize. Every
intermediate file stays in a temp directory; only the final SVG lands in the project.

```bash
T=$(mktemp -d)

# 1. High-contrast source
bun run "${CLAUDE_PLUGIN_ROOT}/scripts/generate-image.ts" "$T/icon-raw.png" --size 1024x1024 \
  "Simple iconic [subject], flat design, centered, white silhouette on black background, no shadows, no gradients"

# 2. Threshold to pure black and white, convert to PBM
magick "$T/icon-raw.png" -background black -flatten -colorspace gray -threshold 50% -negate "$T/icon-bw.png"
magick "$T/icon-bw.png" "$T/icon.pbm"

# 3. Trace
potrace "$T/icon.pbm" -s -o "$T/icon-traced.svg"

# 4. Optimize into the project
bunx svgo "$T/icon-traced.svg" -o ./icon.svg
rm -rf "$T"
```

Read the raw PNG before tracing; when the silhouette is busy, has gradients, or is
off-center, regenerate with a simpler prompt (up to two retries).

## Make it themeable and tight

Replace hard-coded fills with `currentColor` so CSS can color it, and tighten the
`viewBox` to the content bounds (before: `viewBox="0 0 1024 1024"`, the full canvas):

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="200 250 630 530" fill="currentColor">
  <path d="..."/>
</svg>
```
