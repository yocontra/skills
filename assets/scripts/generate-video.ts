#!/usr/bin/env bun
/**
 * Video Generator (ElevenLabs Studio API)
 *
 * NOTE: Requires ElevenLabs Studio API access (by request only).
 * Contact: https://elevenlabs.io/contact-sales
 *
 * Usage:
 *   bun run generate-video.ts <output.mp4> <duration> "<prompt>" [--model <model>]
 *
 * Examples:
 *   bun run generate-video.ts ./intro.mp4 5 "Fog rolling through streets at night"
 *   bun run generate-video.ts ./scene.mp4 4 "Smoke entity emerging from shadows" --model veo-3
 *
 * Environment:
 *   ELEVENLABS_STUDIO_API_KEY - Studio API key (request access from ElevenLabs)
 *
 * Available Models:
 *   sora-2-pro, sora-2, veo-3.1, veo-3.1-fast, veo-3, kling-2.5, seedance-1-pro, wan-2.5
 */

import fs from "node:fs";
import path from "node:path";

const ELEVENLABS_STUDIO_API_KEY = process.env.ELEVENLABS_STUDIO_API_KEY;

const VIDEO_MODELS = [
	"sora-2-pro",
	"sora-2",
	"veo-3.1",
	"veo-3.1-fast",
	"veo-3",
	"veo-3-fast",
	"kling-2.5",
	"seedance-1-pro",
	"wan-2.5",
] as const;
type VideoModel = (typeof VIDEO_MODELS)[number];

const generateVideo = async (
	outputPath: string,
	duration: number,
	prompt: string,
	model: VideoModel = "veo-3",
): Promise<void> => {
	console.log(`Generating video...`);
	console.log(`  Output: ${outputPath}`);
	console.log(`  Duration: ${duration}s`);
	console.log(`  Model: ${model}`);
	console.log(
		`  Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}"`,
	);

	const response = await fetch(
		"https://api.elevenlabs.io/v1/studio/video-generation",
		{
			method: "POST",
			headers: {
				"xi-api-key": ELEVENLABS_STUDIO_API_KEY!,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				prompt: prompt,
				duration_seconds: duration,
				model: model,
			}),
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		if (response.status === 401 || response.status === 403) {
			throw new Error(
				`Studio API access required. Contact ElevenLabs: https://elevenlabs.io/contact-sales\nError: ${errorText}`,
			);
		}
		throw new Error(
			`ElevenLabs Studio API error (${response.status}): ${errorText}`,
		);
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
			'Usage: bun run generate-video.ts <output.mp4> <duration> "<prompt>" [--model <model>]',
		);
		console.error("");
		console.error("Arguments:");
		console.error("  output.mp4  - Output file path");
		console.error("  duration    - Duration in seconds (1 to 60)");
		console.error("  prompt      - Text description of the video to generate");
		console.error("");
		console.error("Options:");
		console.error("  --model <model>  - Video model to use (default: veo-3)");
		console.error("");
		console.error("Available Models:");
		VIDEO_MODELS.forEach((m) => console.error(`  - ${m}`));
		console.error("");
		console.error(
			"NOTE: Requires ElevenLabs Studio API access (by request only)",
		);
		process.exit(1);
	}

	if (!ELEVENLABS_STUDIO_API_KEY) {
		console.error(
			"Error: ELEVENLABS_STUDIO_API_KEY environment variable is required",
		);
		console.error(
			"Contact ElevenLabs to request access: https://elevenlabs.io/contact-sales",
		);
		process.exit(1);
	}

	const modelFlagIndex = args.indexOf("--model");
	let model: VideoModel = "veo-3";

	if (modelFlagIndex !== -1 && args[modelFlagIndex + 1]) {
		const requestedModel = args[modelFlagIndex + 1] as VideoModel;
		if (!VIDEO_MODELS.includes(requestedModel)) {
			console.error(
				`Error: Invalid model "${requestedModel}". Available: ${VIDEO_MODELS.join(", ")}`,
			);
			process.exit(1);
		}
		model = requestedModel;
	}

	const filteredArgs = args.filter(
		(_, i) => i !== modelFlagIndex && i !== modelFlagIndex + 1,
	);
	const [outputFile, durationStr, ...promptParts] = filteredArgs;
	const duration = parseFloat(durationStr);
	const prompt = promptParts.join(" ");

	if (Number.isNaN(duration) || duration < 1 || duration > 60) {
		console.error("Error: Duration must be between 1 and 60 seconds");
		process.exit(1);
	}

	if (!prompt) {
		console.error("Error: Prompt is required");
		process.exit(1);
	}

	const outputPath = path.resolve(process.cwd(), outputFile);
	await generateVideo(outputPath, duration, prompt, model);
};

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
