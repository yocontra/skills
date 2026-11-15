---
name: 3d-model
effort: medium
description: Generate 3D models as GLB with Meshy AI, text-to-3D (preview, refine, remesh) or image-to-3D, with PBR textures and quad topology, polling async tasks and tracking credits. Use for game props, characters, and other 3D assets.
argument-hint: "[subject or reference image] [--polycount N]"
allowed-tools: Bash, Read, Write
---

$ARGUMENTS

# 3D models with Meshy

Follow the [generation workflow](../../shared/workflow.md) and run the
[first-use setup](../../shared/setup.md) (key: `MESHY_API_KEY`). Meshy is called over
its REST API with curl, `Authorization: Bearer $MESHY_API_KEY` read from the
environment. Endpoints, request bodies, polling, and a full scripted pipeline are in
[meshy-api.md](references/meshy-api.md).

## Pipeline

Text-to-3D runs three async tasks:

| Step | Task | Credits | Time |
|---|---|---|---|
| 1. Preview | Untextured mesh (`mode: "preview"`) | 20 | ~60 s |
| 2. Refine | Textures, referencing the preview task (`mode: "refine"`) | 10 | ~90 s |
| 3. Remesh | Topology and GLB export | 5 | ~60 s |

About 35 credits per model. Check the balance before a batch and report credits
spent.

Defaults, unless the target says otherwise:

- `ai_model: "meshy-7.1"` (what `"latest"` resolves to; same 20 credits as
  `meshy-6`, while `meshy-6-lite` is 5).
- `pose_mode: "t-pose"` for humanoid characters (`"a-pose"` also accepted).
- `enable_pbr: true` for PBR maps (metallic, roughness, normal); `false` only when the
  target wants baked base color.
- Remesh with `target_formats: ["glb"]` (one binary with embedded textures),
  `topology: "quad"`, and `target_polycount: 30000`, adjusted to the platform budget.
- Leave out the deprecated `symmetry_mode`, `art_style`, and `is_a_t_pose`.

Every task is async: poll until `status` is `SUCCEEDED` or `FAILED`, printing only the
fields needed, then download `model_urls.glb`. The whole pipeline takes about four
minutes; run it with `run_in_background` and keep working on other assets meanwhile.

With a reference image, image-to-3D does generation, texturing, and remeshing in one
task (30 credits with 2K or 4K textures). The input should show one clean subject on
a plain background; Meshy removes the background itself.

## Prompting

Structure: `[Subject], [Material/Style], [Details], [Setting/Context]`. Maximum 800
characters; longer prompts return 400.

Do:

- Describe one specific object.
- Name materials: brass, copper, leather, wood, stone, marble, ceramic, glass.
- Name styles: Victorian, antique, weathered, ornate, steampunk, gothic, modern, minimalist.
- Keep to 3–5 key descriptors.
- For characters, include "T-pose" and "full body" (and set `pose_mode`).

Avoid:

- Full scenes or multiple objects.
- Abstract concepts such as "magical energy" or "glowing aura".
- Subjective words such as "beautiful" or "amazing".
- Piling on adjectives; returns fall off past five.
