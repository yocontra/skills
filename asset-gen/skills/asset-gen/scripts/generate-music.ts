#!/usr/bin/env bun
/**
 * Music Generator
 *
 * Uses ElevenLabs music generation API to create music tracks.
 *
 * Usage:
 *   bun run generate-music.ts <output.mp3> <duration> "<prompt>"
 *
 * Examples:
 *   bun run generate-music.ts ./ambient.mp3 60 "Dark ambient soundtrack, haunting atmosphere"
 *   bun run generate-music.ts ./track.mp3 120 "Upbeat electronic with synth pads"
 *
 * Environment:
 *   ELEVENLABS_API_KEY - ElevenLabs API key
 */

import fs from "node:fs";
import path from "node:path";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const generateMusic = async (
	outputPath: string,
	duration: number,
	prompt: string,
): Promise<void> => {
	console.log(`Generating music...`);
	console.log(`  Output: ${outputPath}`);
	console.log(`  Duration: ${duration}s`);
	console.log(
		`  Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}"`,
	);

	const response = await fetch(
		"https://api.elevenlabs.io/v1/music-generation",
		{
			method: "POST",
			headers: {
				"xi-api-key": ELEVENLABS_API_KEY!,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				prompt: prompt,
				duration_seconds: duration,
				prompt_influence: 0.5,
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
	const args = process.argv.slice(2);

	if (args.length < 3) {
		console.error(
			'Usage: bun run generate-music.ts <output.mp3> <duration> "<prompt>"',
		);
		console.error("");
		console.error("Arguments:");
		console.error("  output.mp3  - Output file path");
		console.error("  duration    - Duration in seconds (1 to 300)");
		console.error("  prompt      - Text description of the music to generate");
		console.error("");
		console.error("Example:");
		console.error(
			'  bun run generate-music.ts ./ambient.mp3 60 "Dark ambient with ethereal pads"',
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

	if (Number.isNaN(duration) || duration < 1 || duration > 300) {
		console.error("Error: Duration must be between 1 and 300 seconds");
		process.exit(1);
	}

	if (!prompt) {
		console.error("Error: Prompt is required");
		process.exit(1);
	}

	const outputPath = path.resolve(process.cwd(), outputFile);
	await generateMusic(outputPath, duration, prompt);
};

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
