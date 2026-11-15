# Meshy API

Meshy (meshy.ai) generates 3D models over a REST API. Every call authenticates with
`Authorization: Bearer $MESHY_API_KEY` read from the environment. Prompt rules and
defaults are in [SKILL.md](../SKILL.md).

## Pipeline

```
1. Generate  →  text-to-3D preview (untextured mesh)    20 credits, ~60 s
2. Texture   →  refine with baked textures              10 credits, ~90 s
3. Remesh    →  optimize topology, export GLB            5 credits, ~60 s
```

About 35 credits per model. Check the balance before a batch:

```bash
curl -s "https://api.meshy.ai/openapi/v1/balance" -H "Authorization: Bearer $MESHY_API_KEY"
```

## Step 1: preview

```bash
curl -s -X POST "https://api.meshy.ai/openapi/v2/text-to-3d" \
  -H "Authorization: Bearer $MESHY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "preview",
    "prompt": "Your prompt here",
    "ai_model": "meshy-7.1"
  }'
# → {"result": "<task-id>"}
```

| Parameter | Value | Notes |
|---|---|---|
| `mode` | `"preview"` | Required first step |
| `ai_model` | `"meshy-7.1"` | Current model (what `"latest"` resolves to); same 20 credits as `meshy-6`, `meshy-6-lite` is 5 |
| `pose_mode` | `"t-pose"` | For humanoid characters; `"a-pose"` also accepted |

`symmetry_mode`, `art_style`, and `is_a_t_pose` are deprecated; leave them out.

## Step 2: refine (texture)

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

`enable_pbr: true` gives PBR maps (metallic, roughness, normal); `false` gives baked
base color only.

## Step 3: remesh and export

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

| Parameter | Value | Notes |
|---|---|---|
| `target_formats` | `["glb"]` | Single binary with embedded textures |
| `topology` | `"quad"` | Clean quads, good for editing |
| `target_polycount` | `30000` | Adjust to the platform budget |

## Polling

All tasks are async. Poll until `status` is `SUCCEEDED` or `FAILED`. Print only the
fields needed, not the whole response:

```bash
# text-to-3d (preview and refine)
curl -s "https://api.meshy.ai/openapi/v2/text-to-3d/<task-id>" -H "Authorization: Bearer $MESHY_API_KEY"
# remesh
curl -s "https://api.meshy.ai/openapi/v1/remesh/<task-id>" -H "Authorization: Bearer $MESHY_API_KEY"
```

A completed task carries `model_urls.glb`. Download it:

```bash
curl -sL -o ./model.glb "<model_urls.glb>"
```

## Image-to-3D

With a reference image, one task does generation, texturing, and remeshing:

```bash
curl -s -X POST "https://api.meshy.ai/openapi/v1/image-to-3d" \
  -H "Authorization: Bearer $MESHY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "<public-url-or-data-uri>",
    "ai_model": "meshy-7.1",
    "should_remesh": true,
    "topology": "quad",
    "target_polycount": 30000,
    "should_texture": true,
    "enable_pbr": true
  }'
```

The input should show one clean subject on a plain background; Meshy removes the
background itself. Poll at `https://api.meshy.ai/openapi/v1/image-to-3d/<task-id>`.
With 2K or 4K textures this costs 30 credits.

## Full scripted pipeline

Save as a script and run it with `bash` (it uses arrays).

```bash
#!/usr/bin/env bash
set -euo pipefail
H=(-H "Authorization: Bearer $MESHY_API_KEY" -H "Content-Type: application/json")
B="https://api.meshy.ai/openapi"
id() { python3 -c "import sys,json; print(json.load(sys.stdin)['result'])"; }
wait_task() {  # $1 = status URL; prints the final JSON once SUCCEEDED, exits 1 on FAILED
  for _ in $(seq 1 60); do
    r=$(curl -s "$1" -H "Authorization: Bearer $MESHY_API_KEY")
    s=$(printf '%s' "$r" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
    case "$s" in SUCCEEDED) printf '%s' "$r"; return 0;; FAILED|CANCELED) echo "task failed: $1" >&2; return 1;; esac
    sleep 10
  done; echo "timed out: $1" >&2; return 1
}

PREVIEW_ID=$(curl -s -X POST "$B/v2/text-to-3d" "${H[@]}" -d '{
  "mode": "preview",
  "prompt": "A weathered leather briefcase with brass clasps and buckles, vintage patina",
  "ai_model": "meshy-7.1"}' | id)
wait_task "$B/v2/text-to-3d/$PREVIEW_ID" >/dev/null

REFINE_ID=$(curl -s -X POST "$B/v2/text-to-3d" "${H[@]}" \
  -d "{\"mode\": \"refine\", \"preview_task_id\": \"$PREVIEW_ID\", \"enable_pbr\": true}" | id)
wait_task "$B/v2/text-to-3d/$REFINE_ID" >/dev/null

REMESH_ID=$(curl -s -X POST "$B/v1/remesh" "${H[@]}" \
  -d "{\"input_task_id\": \"$REFINE_ID\", \"target_formats\": [\"glb\"], \"topology\": \"quad\", \"target_polycount\": 30000}" | id)
GLB_URL=$(wait_task "$B/v1/remesh/$REMESH_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['model_urls']['glb'])")

curl -sL -o ./briefcase.glb "$GLB_URL"
```

The pipeline takes about four minutes; run it with `run_in_background` and keep working
on other assets meanwhile.
