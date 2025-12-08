import { queueService } from './queueService';
import { llmLogService } from './llmLogService';
import axios from 'axios';
import { env } from '$env/dynamic/private';

interface LlmCallParams {
	messages: { role: string; content: string }[];
	settings: {
		provider: string;
		model: string;
		temperature: number;
		maxTokens: number;
		topP: number;
		frequencyPenalty: number;
		presencePenalty: number;
		reasoningEnabled?: boolean;
		// Featherless-specific parameters
		topK?: number;
		minP?: number;
		repetitionPenalty?: number;
	};
	logType: string;
	logCharacterName?: string;
	logUserName?: string;
	timeout?: number;
}

interface LlmCallResult {
	content: string;
	rawContent: string;
	model: string;
	usage: any;
}

interface ProviderConfig {
	apiKey: string | undefined;
	baseUrl: string;
	name: string;
}

/**
 * Get provider configuration (API key and base URL) for a given provider
 */
function getProviderConfig(provider: string): ProviderConfig {
	const normalized = provider?.toLowerCase() || 'openrouter';

	switch (normalized) {
		case 'featherless':
			return {
				apiKey: env.FEATHERLESS_API_KEY,
				baseUrl: 'https://api.featherless.ai/v1',
				name: 'Featherless'
			};
		case 'openrouter':
		default:
			return {
				apiKey: env.OPENROUTER_API_KEY,
				baseUrl: 'https://openrouter.ai/api/v1',
				name: 'OpenRouter'
			};
	}
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any): boolean {
	const status = error.response?.status;
	const code = error.code;
	return status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
		code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED';
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Shared LLM call function used by all LLM services
 * Handles: request building, reasoning parameter, queueing, response processing, logging, error handling
 * Supports both OpenRouter and Featherless providers
 */
export async function callLlm({
	messages,
	settings,
	logType,
	logCharacterName = 'LLM',
	logUserName = 'System',
	timeout = 120000
}: LlmCallParams): Promise<LlmCallResult> {
	const provider = settings.provider || 'openrouter';
	const providerConfig = getProviderConfig(provider);

	if (!providerConfig.apiKey) {
		throw new Error(`${providerConfig.name} API key not configured`);
	}

	const requestBody: any = {
		model: settings.model,
		messages,
		temperature: settings.temperature,
		max_tokens: settings.maxTokens,
		top_p: settings.topP,
		frequency_penalty: settings.frequencyPenalty,
		presence_penalty: settings.presencePenalty
	};

	// Add reasoning parameter if enabled (OpenRouter only)
	if (settings.reasoningEnabled && provider === 'openrouter') {
		requestBody.reasoning = {
			effort: 'medium'
		};
	}

	// Add Featherless-specific parameters
	if (provider === 'featherless') {
		requestBody.repetition_penalty = settings.repetitionPenalty ?? 1.0;
		requestBody.top_k = settings.topK ?? -1;
		requestBody.min_p = settings.minP ?? 0.0;
	}

	// Log prompt
	const logId = llmLogService.savePromptLog(
		messages as Array<{ role: string; content: string }>,
		logType,
		logCharacterName,
		logUserName
	);

	// Execute request with retry logic
	const maxRetries = 3;
	let lastError: any = null;
	let response: any = null;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			response = await queueService.enqueue(provider, async () => {
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
						timeout
					}
				);
			});

			// Success
			if (attempt > 0) {
				console.log(`✅ ${providerConfig.name} request succeeded after ${attempt} retries`);
			}
			break;
		} catch (error: any) {
			lastError = error;

			if (attempt < maxRetries && isRetryableError(error)) {
				const delayMs = Math.pow(2, attempt + 1) * 1000;
				console.warn(`⚠️ ${providerConfig.name} request failed (${error.response?.status || error.code}), retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
				await sleep(delayMs);
				continue;
			}

			throw error;
		}
	}

	if (!response) {
		throw new Error(lastError?.response?.data?.error?.message || lastError?.message || `${providerConfig.name} service error after ${maxRetries} retries`);
	}

	const rawContent = response.data.choices[0].message.content || '';
	let content = rawContent;

	// Strip any <think></think> tags
	content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
	content = content.replace(/<\/?think>/gi, '').trim();

	// Log response
	llmLogService.saveResponseLog(
		content,
		rawContent,
		logType,
		logId,
		response.data
	);

	// Check if model returned empty content (e.g., used all tokens on reasoning)
	if (!content) {
		const reasoningTokens = response.data.usage?.completion_tokens_details?.reasoning_tokens;
		if (reasoningTokens) {
			throw new Error(`Model used ${reasoningTokens} tokens on reasoning but produced no output. Try increasing max tokens in settings.`);
		}
		throw new Error('Model returned empty response');
	}

	return {
		content,
		rawContent,
		model: response.data.model,
		usage: response.data.usage
	};
}
