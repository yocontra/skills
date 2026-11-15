# Setup, done on first use

Every asset-gen skill runs this once per session before generating.

## API keys

Keys come from environment variables only. Never write a key into a file, a command
line, or the output, and never ask the user to paste one into the chat. Check
presence without printing values, naming the variables the request needs:

```bash
for k in GOOGLE_API_KEY ELEVENLABS_API_KEY MESHY_API_KEY; do
  printenv "$k" >/dev/null && echo "$k set" || echo "$k missing"; done
```

| Asset | Variable |
|---|---|
| Image, SVG | `GOOGLE_API_KEY` |
| Sound effect, music, video | `ELEVENLABS_API_KEY` (video needs a Pro plan or above and the key's Image & Video permission) |
| 3D model | `MESHY_API_KEY` |

If the key for a requested asset is missing, skip that asset, finish the others, and
report which variable to export (in the shell profile or the project's env file),
along with the exact command that will run once it is set.

## Script dependencies

The generators are [Bun](https://bun.sh) scripts in `${CLAUDE_PLUGIN_ROOT}/scripts/`.
Each writes to the output path it is given and creates parent directories as needed.
Install their dependencies (`@google/genai`, `sharp`, pinned in the plugin's
`package.json`) once:

```bash
[ -d "${CLAUDE_PLUGIN_ROOT}/node_modules" ] || bun install --cwd "${CLAUDE_PLUGIN_ROOT}"
```
