---
name: sound
effort: medium
description: Generate sound effects with ElevenLabs, 0.5–30 s with seamless loop support, for UI taps and clicks, notification chimes, game SFX, and ambience. Music and soundtracks go to music.
argument-hint: "[out.mp3] [seconds] [prompt] [--loop]"
allowed-tools: Bash, Read, Write
---

$ARGUMENTS

# Sound effects with ElevenLabs

Follow the [generation workflow](../../shared/workflow.md) and run the
[first-use setup](../../shared/setup.md) (key: `ELEVENLABS_API_KEY`).

## Command

ElevenLabs sound generation (`POST /v1/sound-generation`).

```bash
bun run "${CLAUDE_PLUGIN_ROOT}/scripts/generate-sound-effect.ts" <output.mp3> <duration> "<prompt>" [--loop]
```

| Param | Meaning | Range |
|---|---|---|
| output | File path (`.mp3`) | |
| duration | Seconds | 0.5–30 |
| prompt | What the sound is | text |
| `--loop` | Ask the API for a seamlessly looping sound (ambience) | flag |

Prompts are short and literal: name the sound and its character.

```bash
S="${CLAUDE_PLUGIN_ROOT}/scripts"
bun run "$S/generate-sound-effect.ts" ./click.mp3 0.5 "Crisp button click, subtle and satisfying"
bun run "$S/generate-sound-effect.ts" ./wind.mp3 15 "Gentle wind through trees, nature ambient" --loop
bun run "$S/generate-sound-effect.ts" ./notify.mp3 0.8 "Pleasant notification chime, warm and clear"
```

The minimum is 0.5 s. For a shorter UI sound, generate 0.5 s and trim with
`ffmpeg -i in.mp3 -t 0.3 out.mp3` if ffmpeg is installed.
