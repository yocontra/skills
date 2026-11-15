---
name: music
effort: medium
description: Generate music with ElevenLabs, 3–600 s with an instrumental option, for background tracks, loops, jingles, and game or app soundtracks. Short sound effects go to sound.
argument-hint: "[out.mp3] [seconds] [prompt] [--instrumental]"
allowed-tools: Bash, Read, Write
---

$ARGUMENTS

# Music with ElevenLabs

Follow the [generation workflow](../../shared/workflow.md) and run the
[first-use setup](../../shared/setup.md) (key: `ELEVENLABS_API_KEY`).

## Command

ElevenLabs Music (`POST /v1/music`, length sent as `music_length_ms`).

```bash
bun run "${CLAUDE_PLUGIN_ROOT}/scripts/generate-music.ts" <output.mp3> <duration> "<prompt>" [--instrumental]
```

| Param | Meaning | Range |
|---|---|---|
| output | File path (`.mp3`) | |
| duration | Seconds | 3–600 |
| prompt | Genre, mood, instrumentation | text |
| `--instrumental` | Sets `force_instrumental`, guaranteeing no vocals | flag |

Prompts name genre, mood, and instrumentation, and say "loopable" when the track
repeats. Pass `--instrumental` for background music.

```bash
S="${CLAUDE_PLUGIN_ROOT}/scripts"
bun run "$S/generate-music.ts" ./bg-music.mp3 120 "Lo-fi chill hop, relaxed atmosphere, loopable" --instrumental
bun run "$S/generate-music.ts" ./jingle.mp3 15 "Upbeat success jingle, bright and celebratory"
bun run "$S/generate-music.ts" ./ambient.mp3 180 "Deep ambient soundscape, ethereal pads, slow evolution" --instrumental
```
