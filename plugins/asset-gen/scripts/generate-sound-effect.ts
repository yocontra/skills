#!/usr/bin/env bun
/**
 * Sound Effect Generator
 *
 * Uses ElevenLabs text-to-sound-effects API to generate sound effects.
 *
 * Usage:
 *   bun run generate-sound-effect.ts <output.mp3> <duration> "<prompt>" [--loop]
 *
 * Examples:
 *   bun run generate-sound-effect.ts ./tap.mp3 0.5 "Ethereal chime with ghostly whisper"
 *   bun run generate-sound-effect.ts ./wind.mp3 15 "Dark ambient wind drone, low frequency rumble" --loop
 *
 * Environment:
 *   ELEVENLABS_API_KEY - ElevenLabs API key
 */

import fs from "node:fs";
import path from "node:path";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const generateSoundEffect = async (
	outputPath: string,
	duration: number,
	prompt: string,
	loop: boolean,
): Promise<void> => {
	console.log(`Generating sound effect...`);
	console.log(`  Output: ${outputPath}`);
	console.log(`  Duration: ${duration}s${loop ? " (seamless loop)" : ""}`);
	console.log(
		`  Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}"`,
	);

	const response = await fetch(
		"https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128",
		{
			method: "POST",
			headers: {
				"xi-api-key": ELEVENLABS_API_KEY!,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				text: prompt,
				duration_seconds: duration,
				prompt_influence: 0.5,
				loop,
			}),
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
	}

	const buffer = await response.arrayBuffer();

	const outputDir = path.dirname(outputPath);
	if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

	fs.writeFileSync(outputPath, Buffer.from(buffer));
	console.log(`  Done: ${outputPath}`);
};

const main = async () => {
	const loop = process.argv.includes("--loop");
	const args = process.argv.slice(2).filter((a) => a !== "--loop");

	if (args.length < 3) {
		console.error(
			'Usage: bun run generate-sound-effect.ts <output.mp3> <duration> "<prompt>" [--loop]',
		);
		console.error("");
		console.error("Arguments:");
		console.error("  output.mp3  - Output file path");
		console.error("  duration    - Duration in seconds (0.5 to 30)");
		console.error("  prompt      - Text description of the sound to generate");
		console.error("  --loop      - Generate a sound that loops seamlessly");
		console.error("");
		console.error("Example:");
		console.error(
			'  bun run generate-sound-effect.ts ./chime.mp3 0.5 "Ethereal chime with reverb"',
		);
		process.exit(1);
	}

	if (!ELEVENLABS_API_KEY) {
		console.error("Error: ELEVENLABS_API_KEY environment variable is required");
		process.exit(1);
	}

	const [outputFile, durationStr, ...promptParts] = args;
	const duration = parseFloat(durationStr);
	const prompt = promptParts.join(" ");

	if (Number.isNaN(duration) || duration < 0.5 || duration > 30) {
		console.error("Error: Duration must be between 0.5 and 30 seconds");
		process.exit(1);
	}

	if (!prompt) {
		console.error("Error: Prompt is required");
		process.exit(1);
	}

	const outputPath = path.resolve(process.cwd(), outputFile);
	await generateSoundEffect(outputPath, duration, prompt, loop);
};

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
