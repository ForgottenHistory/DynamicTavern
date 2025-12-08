import axios from 'axios';
import { llmSettingsService } from './llmSettingsService';
import { queueService } from './queueService';
import { OPENROUTER_API_KEY, FEATHERLESS_API_KEY } from '$env/static/private';

interface Message {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface ChatCompletionParams {
	messages: Message[];
	userId?: number;
	model?: string;
	temperature?: number;
	maxTokens?: number;
}

interface ChatCompletionResponse {
	content: string;
	model: string;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
	// Include choices for reasoning extraction in logs
	choices?: any[];
	// Reasoning content if available
	reasoning?: string | null;
}

interface ProviderConfig {
	apiKey: string;
	baseUrl: string;
	name: string;
}

class LlmService {
	private openrouterApiKey: string;
	private featherlessApiKey: string;
	private openrouterBaseUrl: string;
	private featherlessBaseUrl: string;

	constructor() {
		this.openrouterApiKey = OPENROUTER_API_KEY || '';
		this.featherlessApiKey = FEATHERLESS_API_KEY || '';
		this.openrouterBaseUrl = 'https://openrouter.ai/api/v1';
		this.featherlessBaseUrl = 'https://api.featherless.ai/v1';

		if (!this.openrouterApiKey) {
			console.warn('⚠️  OPENROUTER_API_KEY not found in environment variables');
		}
		if (!this.featherlessApiKey) {
			console.warn('⚠️  FEATHERLESS_API_KEY not found in environment variables');
		}
	}

	/**
	 * Get provider configuration (API key and base URL)
	 */
	private getProviderConfig(provider: string): ProviderConfig {
		const normalized = provider?.toLowerCase() || 'openrouter';

		switch (normalized) {
			case 'featherless':
				return {
					apiKey: this.featherlessApiKey,
					baseUrl: this.featherlessBaseUrl,
					name: 'Featherless'
				};
			case 'openrouter':
			default:
				return {
					apiKey: this.openrouterApiKey,
					baseUrl: this.openrouterBaseUrl,
					name: 'OpenRouter'
				};
		}
	}

	/**
	 * Check if an error is retryable (rate limit or server error)
	 */
	private isRetryableError(error: any): boolean {
		const status = error.response?.status;
		// Retry on: 429 (rate limit), 500, 502, 503, 504 (server errors)
		return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
	}

	/**
	 * Sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Create a chat completion with retry logic and queueing
	 */
	async createChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
		const { messages, userId, model, temperature, maxTokens } = params;

		// Get user settings or defaults
		const userSettings = userId
			? await llmSettingsService.getUserSettings(userId)
			: llmSettingsService.getDefaultSettings();

		const selectedModel = model || userSettings.model;
		const selectedTemperature = temperature ?? userSettings.temperature;
		const selectedMaxTokens = maxTokens ?? userSettings.maxTokens;
		const provider = userSettings.provider || 'openrouter';

		// Get provider configuration
		const providerConfig = this.getProviderConfig(provider);

		if (!providerConfig.apiKey) {
			throw new Error(`${providerConfig.name} API key not configured`);
		}

		console.log(`🤖 ${providerConfig.name} Request:`, {
			provider,
			model: selectedModel,
			temperature: selectedTemperature,
			max_tokens: selectedMaxTokens,
			messageCount: messages.length,
			reasoningEnabled: userSettings.reasoningEnabled
		});

		// Build request body
		const requestBody: any = {
			model: selectedModel,
			messages,
			temperature: selectedTemperature,
			max_tokens: selectedMaxTokens,
			top_p: userSettings.topP,
			frequency_penalty: userSettings.frequencyPenalty,
			presence_penalty: userSettings.presencePenalty
		};

		// Add reasoning parameter if enabled (OpenRouter only)
		if (userSettings.reasoningEnabled && provider === 'openrouter') {
			requestBody.reasoning = {
				effort: 'medium'
			};
		}

		// Add Featherless-specific parameters
		if (provider === 'featherless') {
			requestBody.repetition_penalty = userSettings.repetitionPenalty ?? 1.0;
			requestBody.top_k = userSettings.topK ?? -1;
			requestBody.min_p = userSettings.minP ?? 0.0;
		}

		// Retry logic with exponential backoff
		const maxRetries = 3;
		let lastError: any = null;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				// Execute request through queue to respect concurrency limits
				const response = await queueService.enqueue(provider, async () => {
					return await axios.post(
						`${providerConfig.baseUrl}/chat/completions`,
						requestBody,
						{
							headers: {
								Authorization: `Bearer ${providerConfig.apiKey}`,
								'Content-Type': 'application/json',
								'HTTP-Referer': 'https://localhost:5173',
								'X-Title': 'AI-Chat-Template'
							},
							timeout: 120000 // 120 second timeout
						}
					);
				});

				// Success! Break out of retry loop
				if (attempt > 0) {
					console.log(
						`✅ ${providerConfig.name} request succeeded after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}`
					);
				}

				const message = response.data.choices[0].message;
				let content = message.content || '';

				// Extract reasoning content from various possible locations
				let reasoning: string | null = null;
				if (message.reasoning) {
					reasoning = message.reasoning;
				} else if (message.reasoning_content) {
					reasoning = message.reasoning_content;
				}

				// Strip any <think></think> tags (reasoning output) - extract first if present
				const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i);
				if (thinkMatch && !reasoning) {
					reasoning = thinkMatch[1].trim();
				}
				content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
				content = content.replace(/<\/?think>/gi, '').trim();

				// Check if model returned empty content (e.g., used all tokens on reasoning)
				if (!content) {
					const reasoningTokens = response.data.usage?.completion_tokens_details?.reasoning_tokens;
					if (reasoningTokens) {
						throw new Error(`Model used ${reasoningTokens} tokens on reasoning but produced no output. Try increasing max tokens in settings.`);
					}
					throw new Error('Model returned empty response');
				}

				console.log(`✅ ${providerConfig.name} Response:`, {
					provider,
					model: response.data.model,
					contentLength: content?.length || 0,
					reasoningLength: reasoning?.length || 0,
					usage: response.data.usage
				});

				return {
					content,
					model: response.data.model,
					usage: response.data.usage,
					choices: response.data.choices,
					reasoning
				};
			} catch (error: any) {
				lastError = error;
				const status = error.response?.status;

				// Check if error is retryable
				if (attempt < maxRetries && this.isRetryableError(error)) {
					// Calculate exponential backoff: 1s, 2s, 4s
					const delayMs = Math.pow(2, attempt) * 1000;
					console.warn(
						`⚠️  ${providerConfig.name} request failed (${status || error.code}), retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`
					);
					await this.sleep(delayMs);
					continue; // Retry
				}

				// Non-retryable error or max retries exceeded
				console.error(`❌ ${providerConfig.name} API error (after ${attempt} retries):`, {
					provider,
					message: error.message,
					status: error.response?.status,
					statusText: error.response?.statusText,
					data: error.response?.data,
					model: selectedModel
				});
				break;
			}
		}

		// All retries failed
		throw new Error(
			lastError.response?.data?.error?.message ||
				lastError.message ||
				`${providerConfig.name} service error after ${maxRetries} retries`
		);
	}

	/**
	 * Simple completion for basic tasks (single prompt → response)
	 */
	async createSimpleCompletion(prompt: string, userId?: number): Promise<string> {
		const response = await this.createChatCompletion({
			messages: [{ role: 'user', content: prompt }],
			userId
		});
		return response.content;
	}
}

export const llmService = new LlmService();
