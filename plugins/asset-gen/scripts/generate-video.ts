#!/usr/bin/env bun
/**
 * Video Generator (ElevenLabs Image & Video API)
 *
 * Starts a generation with POST /v1/flows/video, polls GET /v1/flows/video/{id} every
 * 10 seconds until it is completed or failed, then downloads the MP4 from content_url.
 * Needs an ElevenLabs Pro plan or above (402 paid_plan_required otherwise) and an API key
 * with the Image & Video permission. ByteDance models also need approval from ElevenLabs.
 *
 * Usage:
 *   bun run generate-video.ts <output.mp4> <duration> "<prompt>" [--model <model>] [--aspect 16:9|9:16] [--resolution 720p|1080p|4K]
 *
 * Examples:
 *   bun run generate-video.ts ./intro.mp4 8 "Fog rolling through streets at night"
 *   bun run generate-video.ts ./scene.mp4 6 "Smoke rising from a candle" --model veo-3.1-generate-001 --resolution 1080p
 *
 * Environment:
 *   ELEVENLABS_API_KEY - ElevenLabs API key
 */

import fs from "node:fs";
import path from "node:path";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const API = "https://api.elevenlabs.io/v1/flows/video";

const VIDEO_MODELS = [
	"veo-3.1-fast-generate-001",
	"veo-3.1-generate-001",
	"bytedance-seedance-v2",
	"bytedance-seedance-v2-fast",
] as const;
type VideoModel = (typeof VIDEO_MODELS)[number];
const DEFAULT_MODEL: VideoModel = "veo-3.1-fast-generate-001";

const isVeo = (model: VideoModel) => model.startsWith("veo-");

const POLL_INTERVAL_MS = 10_000;
const MAX_WAIT_MS = 15 * 60_000;

interface VideoOptions {
	model: VideoModel;
	aspectRatio?: string;
	resolution?: string;
}

type Generation =
	| { status: "pending" | "generating"; id: string }
	| {
			status: "completed";
			id: string;
			content_url: string;
			content_mime_type: string;
	  }
	| {
			status: "failed";
			id: string;
			error_message: string;
			failure_reason: string;
	  };

const api = async (url: string, init?: RequestInit): Promise<Response> => {
	const response = await fetch(url, {
		...init,
		headers: {
			"xi-api-key": ELEVENLABS_API_KEY!,
			"Content-Type": "application/json",
			...init?.headers,
		},
	});
	if (!response.ok) {
		const errorText = await response.text();
		if (
			response.status === 401 ||
			response.status === 402 ||
			response.status === 403
		) {
			throw new Error(
				`ElevenLabs video access denied (${response.status}). Video needs a Pro plan or above and a key with the Image & Video permission.\n${errorText}`,
			);
		}
		throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
	}
	return response;
};

const generateVideo = async (
	outputPath: string,
	duration: number,
	prompt: string,
	options: VideoOptions,
): Promise<void> => {
	console.log(`Generating video...`);
	console.log(`  Output: ${outputPath}`);
	console.log(`  Duration: ${duration}s`);
	console.log(`  Model: ${options.model}`);
	console.log(
		`  Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}"`,
	);

	const body: Record<string, unknown> = {
		model_id: options.model,
		prompt,
		duration_secs: duration,
	};
	if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;
	if (options.resolution) body.resolution = options.resolution;

	const created = (await (
		await api(API, { method: "POST", body: JSON.stringify(body) })
	).json()) as { id: string };
	console.log(`  Generation: ${created.id}`);

	const started = Date.now();
	let generation: Generation;
	for (;;) {
		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
		generation = (await (
			await api(`${API}/${created.id}`)
		).json()) as Generation;
		if (generation.status === "completed" || generation.status === "failed")
			break;
		if (Date.now() - started > MAX_WAIT_MS) {
			throw new Error(
				`Timed out after ${MAX_WAIT_MS / 60_000} min; generation ${created.id} is still ${generation.status}`,
			);
		}
		console.log(
			`  ${generation.status}... ${Math.round((Date.now() - started) / 1000)}s`,
		);
	}

	if (generation.status === "failed") {
		throw new Error(
			`Generation failed (${generation.failure_reason}): ${generation.error_message}`,
		);
	}

	const download = await fetch(generation.content_url);
	if (!download.ok) throw new Error(`Download failed (${download.status})`);
	const buffer = await download.arrayBuffer();

	const outputDir = path.dirname(outputPath);
	if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

	fs.writeFileSync(outputPath, Buffer.from(buffer));
	console.log(`  Done: ${outputPath}`);
};

const takeFlag = (args: string[], flag: string): string | undefined => {
	const i = args.indexOf(flag);
	if (i === -1 || !args[i + 1]) return undefined;
	const value = args[i + 1];
	args.splice(i, 2);
	return value;
};

const main = async () => {
	const args = process.argv.slice(2);
	const requestedModel = takeFlag(args, "--model");
	const aspectRatio = takeFlag(args, "--aspect");
	const resolution = takeFlag(args, "--resolution");

	if (args.length < 3) {
		console.error(
			'Usage: bun run generate-video.ts <output.mp4> <duration> "<prompt>" [--model <model>] [--aspect <ratio>] [--resolution <res>]',
		);
		console.error("");
		console.error("Arguments:");
		console.error("  output.mp4  - Output file path");
		console.error(
			"  duration    - Seconds: 4, 6, or 8 for Veo; an integer for Seedance",
		);
		console.error("  prompt      - Text description of the video to generate");
		console.error("");
		console.error("Options:");
		console.error(
			`  --model <model>       - Video model (default: ${DEFAULT_MODEL})`,
		);
		console.error("  --aspect <ratio>      - 16:9 (default) or 9:16 for Veo");
		console.error(
			"  --resolution <res>    - 720p (default), 1080p, 4K (Veo) or 4k (Seedance v2)",
		);
		console.error("");
		console.error("Available Models:");
		VIDEO_MODELS.forEach((m) => console.error(`  - ${m}`));
		process.exit(1);
	}

	if (!ELEVENLABS_API_KEY) {
		console.error("Error: ELEVENLABS_API_KEY environment variable is required");
		process.exit(1);
	}

	let model: VideoModel = DEFAULT_MODEL;
	if (requestedModel) {
		if (!(VIDEO_MODELS as readonly string[]).includes(requestedModel)) {
			console.error(
				`Error: Invalid model "${requestedModel}". Available: ${VIDEO_MODELS.join(", ")}`,
			);
			process.exit(1);
		}
		model = requestedModel as VideoModel;
	}

	const [outputFile, durationStr, ...promptParts] = args;
	const duration = Number(durationStr);
	const prompt = promptParts.join(" ");

	if (!Number.isInteger(duration) || duration < 1) {
		console.error("Error: Duration must be a whole number of seconds");
		process.exit(1);
	}
	if (isVeo(model) && ![4, 6, 8].includes(duration)) {
		console.error("Error: Veo models take a duration of 4, 6, or 8 seconds");
		process.exit(1);
	}

	if (!prompt) {
		console.error("Error: Prompt is required");
		process.exit(1);
	}

	const outputPath = path.resolve(process.cwd(), outputFile);
	await generateVideo(outputPath, duration, prompt, {
		model,
		aspectRatio,
		resolution,
	});
};

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
