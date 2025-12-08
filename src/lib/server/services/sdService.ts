import { env } from '$env/dynamic/private';

interface SDSettings {
	steps: number;
	cfgScale: number;
	sampler: string;
	scheduler: string;
	width: number;
	height: number;
	enableHr: boolean;
	hrScale: number;
	hrUpscaler: string;
	hrSteps: number;
	denoisingStrength: number;
	enableAdetailer: boolean;
	adetailerModel: string;
	mainPrompt: string;
	negativePrompt: string;
	model: string;
}

interface GenerateImageParams {
	characterTags?: string;
	contextTags?: string;
	additionalPrompt?: string;
	negativePrompt?: string;
	settings?: Partial<SDSettings>;
	// Character-specific overrides (take precedence over global settings)
	mainPromptOverride?: string;
	negativePromptOverride?: string;
}

interface GenerateImageResult {
	success: boolean;
	imageBuffer?: Buffer;
	imageBase64?: string;
	prompt?: string;
	negativePrompt?: string;
	generationTime?: number;
	error?: string;
}

const DEFAULT_SETTINGS: SDSettings = {
	steps: 30,
	cfgScale: 7.0,
	sampler: 'DPM++ 2M',
	scheduler: 'Karras',
	width: 832,
	height: 1216,
	enableHr: true,
	hrScale: 1.5,
	hrUpscaler: 'Latent',
	hrSteps: 15,
	denoisingStrength: 0.7,
	enableAdetailer: false,
	adetailerModel: 'face_yolov8n.pt',
	mainPrompt: 'masterpiece, best quality, amazing quality, 1girl, solo',
	negativePrompt: 'lowres, bad anatomy, bad hands, text, error, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, speech bubble, multiple views',
	model: ''
};

class SDService {
	private baseUrl: string;

	constructor() {
		this.baseUrl = env.SD_SERVER_URL || 'http://127.0.0.1:7860';
	}

	/**
	 * Check if an error is retryable
	 */
	private isRetryableError(error: any): boolean {
		const status = error.response?.status;
		const code = error.code;
		return status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
			code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED';
	}

	/**
	 * Sleep helper
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Generate image using Stable Diffusion
	 */
	async generateImage({
		characterTags = '',
		contextTags = '',
		additionalPrompt = '',
		negativePrompt,
		settings = {},
		mainPromptOverride,
		negativePromptOverride
	}: GenerateImageParams): Promise<GenerateImageResult> {
		const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };

		try {
			// Use character-specific overrides if provided, otherwise use global settings
			const basePrompt = mainPromptOverride?.trim() || mergedSettings.mainPrompt;
			const baseNegative = negativePromptOverride?.trim() || mergedSettings.negativePrompt;

			// Build full prompt
			console.log(`🎨 Building prompt from parts:`);
			console.log(`  basePrompt: ${basePrompt}`);
			console.log(`  characterTags: ${characterTags}`);
			console.log(`  contextTags: ${contextTags}`);
			console.log(`  additionalPrompt: ${additionalPrompt}`);

			const fullPrompt = [basePrompt, characterTags, contextTags, additionalPrompt]
				.filter(p => p && p.trim())
				.join(', ');

			const fullNegative = negativePrompt || baseNegative;

			console.log(`🎨 Generating image with SD...`);
			console.log(`Prompt: ${fullPrompt}`);

			const startTime = Date.now();

			// Build payload - use explicit random seed to ensure different results each time
			const randomSeed = Math.floor(Math.random() * 2147483647);
			const payload: any = {
				prompt: fullPrompt,
				negative_prompt: fullNegative,
				width: mergedSettings.width,
				height: mergedSettings.height,
				steps: mergedSettings.steps,
				cfg_scale: mergedSettings.cfgScale,
				sampler_name: mergedSettings.sampler,
				scheduler: mergedSettings.scheduler,
				seed: randomSeed,
				batch_size: 1,
				n_iter: 1,
				send_images: true,
				save_images: false
			};

			// Add model override if specified
			if (mergedSettings.model && mergedSettings.model.trim()) {
				payload.override_settings = {
					sd_model_checkpoint: mergedSettings.model
				};
			}

			// Add Highres fix if enabled
			if (mergedSettings.enableHr) {
				payload.enable_hr = true;
				payload.hr_scale = mergedSettings.hrScale;
				payload.hr_upscaler = mergedSettings.hrUpscaler;
				payload.hr_second_pass_steps = mergedSettings.hrSteps;
				payload.denoising_strength = mergedSettings.denoisingStrength;
			}

			// Add ADetailer if enabled
			if (mergedSettings.enableAdetailer) {
				payload.alwayson_scripts = {
					ADetailer: {
						args: [
							true,
							false,
							{
								ad_model: mergedSettings.adetailerModel,
								ad_confidence: 0.5,
								ad_denoising_strength: 0.4
							}
						]
					}
				};
			}

			// Make request with retry logic
			const maxRetries = 3;
			let lastError: any = null;
			let response: any = null;

			for (let attempt = 0; attempt <= maxRetries; attempt++) {
				try {
					const fetchResponse = await fetch(`${this.baseUrl}/sdapi/v1/txt2img`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload),
						signal: AbortSignal.timeout(300000) // 5 minute timeout
					});

					if (!fetchResponse.ok) {
						throw new Error(`SD server returned ${fetchResponse.status}`);
					}

					response = await fetchResponse.json();

					if (attempt > 0) {
						console.log(`✅ SD image generation succeeded after ${attempt} retries`);
					}
					break;
				} catch (error: any) {
					lastError = error;

					if (attempt < maxRetries && this.isRetryableError(error)) {
						const delayMs = Math.pow(2, attempt + 1) * 1000;
						console.warn(`⚠️ SD generation failed, retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
						await this.sleep(delayMs);
						continue;
					}

					throw error;
				}
			}

			if (!response) {
				throw lastError;
			}

			if (!response.images || response.images.length === 0) {
				throw new Error('No images returned from SD server');
			}

			const base64Image = response.images[0];
			const generationTime = Date.now() - startTime;

			console.log(`✅ Image generated in ${generationTime}ms`);

			return {
				success: true,
				imageBuffer: Buffer.from(base64Image, 'base64'),
				imageBase64: base64Image,
				prompt: fullPrompt,
				negativePrompt: fullNegative,
				generationTime
			};
		} catch (error: any) {
			console.error('❌ SD generation error:', error.message);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Check if SD server is available
	 */
	async checkHealth(): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/sdapi/v1/sd-models`, {
				signal: AbortSignal.timeout(5000)
			});
			return response.ok;
		} catch (error: any) {
			console.error('SD server health check failed:', error.message);
			return false;
		}
	}

	/**
	 * Get available models from SD server
	 */
	async getModels(): Promise<string[]> {
		try {
			const response = await fetch(`${this.baseUrl}/sdapi/v1/sd-models`, {
				signal: AbortSignal.timeout(10000)
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch models: ${response.status}`);
			}

			const models = await response.json();
			return models.map((m: any) => m.title || m.model_name);
		} catch (error: any) {
			console.error('Failed to get SD models:', error.message);
			return [];
		}
	}

	/**
	 * Get available samplers from SD server
	 */
	async getSamplers(): Promise<string[]> {
		try {
			const response = await fetch(`${this.baseUrl}/sdapi/v1/samplers`, {
				signal: AbortSignal.timeout(10000)
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch samplers: ${response.status}`);
			}

			const samplers = await response.json();
			return samplers.map((s: any) => s.name);
		} catch (error: any) {
			console.error('Failed to get SD samplers:', error.message);
			return [];
		}
	}
}

export const sdService = new SDService();
