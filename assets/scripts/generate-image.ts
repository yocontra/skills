#!/usr/bin/env bun

/**
 * Image Generator
 *
 * Uses Google Gemini to generate images.
 *
 * Usage:
 *   bun run generate-image.ts <output.png> "<prompt>" [options]
 *
 * Examples:
 *   bun run generate-image.ts ./icon.png "Spirit icon on black" --size icon
 *   bun run generate-image.ts ./splash.png "Fog scene" --size 1242x2436 --quality 100
 *   bun run generate-image.ts ./out.png "Put him facing the camera" --ref ./input.png --size square
 *
 * Environment:
 *   GOOGLE_API_KEY - Google Gemini API key
 */

import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Common presets for image assets
const SIZE_PRESETS: Record<string, { width: number; height: number }> = {
	icon: { width: 1024, height: 1024 },
	"adaptive-icon": { width: 1024, height: 1024 },
	favicon: { width: 120, height: 120 },
	splash: { width: 1242, height: 2436 },
	thumbnail: { width: 400, height: 400 },
	card: { width: 800, height: 600 },
	banner: { width: 1200, height: 400 },
	square: { width: 512, height: 512 },
	"2k": { width: 2048, height: 2048 },
	"4k": { width: 4096, height: 4096 },
};

interface GenerateOptions {
	width?: number;
	height?: number;
	quality?: number;
	model?: "gemini-2.5-flash-image" | "gemini-3-pro-image-preview";
	/** Optional reference image path — sent alongside the prompt for edits */
	refImage?: string;
}

const detectImageFormat = (
	buffer: Buffer,
): "png" | "jpeg" | "webp" | "unknown" => {
	if (
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47
	)
		return "png";
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
		return "jpeg";
	if (
		buffer[0] === 0x52 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x46
	) {
		if (
			buffer[8] === 0x57 &&
			buffer[9] === 0x45 &&
			buffer[10] === 0x42 &&
			buffer[11] === 0x50
		)
			return "webp";
	}
	return "unknown";
};

const processImage = async (
	inputBuffer: Buffer,
	outputPath: string,
	options: { width?: number; height?: number; quality?: number },
): Promise<Buffer> => {
	const sharp = await import("sharp").catch(() => {
		throw new Error(
			"'sharp' package is required for image processing. Install with: bun add -d sharp",
		);
	});

	let pipeline = sharp.default(inputBuffer);

	if (options.width || options.height) {
		pipeline = pipeline.resize(options.width, options.height, {
			fit: "cover",
			position: "center",
		});
	}

	const ext = path.extname(outputPath).toLowerCase();
	const quality = options.quality ?? 90;

	switch (ext) {
		case ".png":
			pipeline = pipeline.png({
				compressionLevel: 9 - Math.floor((quality / 100) * 9),
			});
			break;
		case ".jpg":
		case ".jpeg":
			pipeline = pipeline.jpeg({ quality, mozjpeg: true });
			break;
		case ".webp":
			pipeline = pipeline.webp({ quality });
			break;
		default:
			pipeline = pipeline.png();
	}

	const outputBuffer = await pipeline.toBuffer();
	return Buffer.from(outputBuffer);
};

const generateImage = async (
	outputPath: string,
	prompt: string,
	options: GenerateOptions = {},
): Promise<void> => {
	const model = options.model ?? "gemini-3-pro-image-preview";

	console.log(`Generating image...`);
	console.log(`  Output: ${outputPath}`);
	console.log(`  Model: ${model}`);
	if (options.width || options.height)
		console.log(
			`  Size: ${options.width ?? "auto"}x${options.height ?? "auto"}`,
		);
	if (options.quality) console.log(`  Quality: ${options.quality}%`);
	if (options.refImage) console.log(`  Reference: ${options.refImage}`);
	console.log(
		`  Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}"`,
	);

	const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY! });

	let fullPrompt = prompt;
	if (options.width && options.height) {
		fullPrompt = `Create an image with dimensions ${options.width}x${options.height} pixels. ${prompt}`;
	}

	let contents:
		| string
		| {
				role: string;
				parts: (
					| { text: string }
					| { inlineData: { mimeType: string; data: string } }
				)[];
		  }[];

	if (options.refImage) {
		const refPath = path.resolve(process.cwd(), options.refImage);
		if (!fs.existsSync(refPath))
			throw new Error(`Reference image not found: ${refPath}`);
		const refBuffer = fs.readFileSync(refPath);
		const refExt = path.extname(refPath).toLowerCase();
		const mimeType =
			refExt === ".jpg" || refExt === ".jpeg"
				? "image/jpeg"
				: refExt === ".webp"
					? "image/webp"
					: "image/png";
		contents = [
			{
				role: "user",
				parts: [
					{ inlineData: { mimeType, data: refBuffer.toString("base64") } },
					{ text: fullPrompt },
				],
			},
		];
	} else {
		contents = fullPrompt;
	}

	const response = await ai.models.generateContent({ model, contents });

	if (!response.candidates || response.candidates.length === 0)
		throw new Error("No candidates in response");
	const candidate = response.candidates[0];
	if (!candidate?.content?.parts)
		throw new Error("No content parts in response candidate");

	let base64Data: string | undefined;
	for (const part of candidate.content.parts) {
		if (part.inlineData?.data) {
			base64Data = part.inlineData.data;
			break;
		}
	}
	if (!base64Data) throw new Error("No image generated in response");

	const outputDir = path.dirname(outputPath);
	if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

	let buffer: Buffer = Buffer.from(base64Data, "base64");
	const sourceFormat = detectImageFormat(buffer);

	const ext = path.extname(outputPath).toLowerCase();
	const needsResize = options.width || options.height;
	const needsConvert =
		(sourceFormat === "jpeg" && ext === ".png") ||
		(sourceFormat === "png" && (ext === ".jpg" || ext === ".jpeg")) ||
		ext === ".webp";

	if (needsResize || needsConvert || options.quality) {
		console.log(
			`  Processing: ${sourceFormat.toUpperCase()} -> ${ext.slice(1).toUpperCase()}...`,
		);
		buffer = await processImage(buffer, outputPath, {
			width: options.width,
			height: options.height,
			quality: options.quality,
		});
	}

	fs.writeFileSync(outputPath, buffer);
	console.log(`  Done: ${outputPath} (${(buffer.length / 1024).toFixed(1)}KB)`);
};

const parseSize = (sizeStr: string): { width: number; height: number } => {
	if (SIZE_PRESETS[sizeStr.toLowerCase()])
		return SIZE_PRESETS[sizeStr.toLowerCase()];
	const match = sizeStr.match(/^(\d+)x(\d+)$/i);
	if (!match)
		throw new Error(
			`Invalid size format: "${sizeStr}". Use WxH (e.g., 1024x1024) or a preset name.`,
		);
	return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
};

const main = async () => {
	const args = process.argv.slice(2);

	if (args.length < 2) {
		console.error(
			'Usage: bun run generate-image.ts <output> "<prompt>" [options]',
		);
		console.error("");
		console.error("Arguments:");
		console.error("  output   - Output file path (.png, .jpg, .webp)");
		console.error("  prompt   - Text description of the image to generate");
		console.error("");
		console.error("Options:");
		console.error(
			"  --size <WxH|preset>  - Output dimensions (default: native)",
		);
		console.error(
			"  --quality <1-100>    - Output quality percentage (default: 90)",
		);
		console.error("  --ref <image>        - Reference image to edit/transform");
		console.error("  --flash              - Use faster gemini-2.5-flash model");
		console.error("");
		console.error("Size Presets:");
		Object.entries(SIZE_PRESETS).forEach(([name, { width, height }]) => {
			console.error(`  ${name.padEnd(14)} - ${width}x${height}`);
		});
		process.exit(1);
	}

	if (!GOOGLE_API_KEY) {
		console.error("Error: GOOGLE_API_KEY environment variable is required");
		process.exit(1);
	}

	const options: GenerateOptions = {};
	const positionalArgs: string[] = [];
	let i = 0;

	while (i < args.length) {
		const arg = args[i];
		if (arg === "--size" && args[i + 1]) {
			const { width, height } = parseSize(args[i + 1]);
			options.width = width;
			options.height = height;
			i += 2;
		} else if (arg === "--quality" && args[i + 1]) {
			const q = parseInt(args[i + 1], 10);
			if (Number.isNaN(q) || q < 1 || q > 100) {
				console.error("Error: Quality must be 1-100");
				process.exit(1);
			}
			options.quality = q;
			i += 2;
		} else if (arg === "--ref" && args[i + 1]) {
			options.refImage = args[i + 1];
			i += 2;
		} else if (arg === "--flash") {
			options.model = "gemini-2.5-flash-image";
			i += 1;
		} else {
			positionalArgs.push(arg);
			i += 1;
		}
	}

	if (positionalArgs.length < 2) {
		console.error("Error: Output file and prompt are required");
		process.exit(1);
	}

	const [outputFile, ...promptParts] = positionalArgs;
	const prompt = promptParts.join(" ");
	if (!prompt) {
		console.error("Error: Prompt is required");
		process.exit(1);
	}

	const outputPath = path.resolve(process.cwd(), outputFile);
	await generateImage(outputPath, prompt, options);
};

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
