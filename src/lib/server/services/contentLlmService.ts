import { contentLlmSettingsService } from './contentLlmSettingsService';
import { callLlm } from './llmCallService';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_DIR = 'data/prompts';

export type ContentType = 'description' | 'personality' | 'scenario' | 'message_example' | 'greeting';

class ContentLlmService {
	/**
	 * Load a content prompt from file (always reads fresh from disk)
	 */
	async loadPrompt(type: ContentType): Promise<string> {
		try {
			const content = await fs.readFile(path.join(PROMPTS_DIR, `content_${type}.txt`), 'utf-8');
			return content.trim();
		} catch (error) {
			console.error(`Failed to load content prompt for ${type}, using default:`, error);
			return `Rewrite the following ${type.replace('_', ' ')} to be clean and well-formatted:\n\n{{input}}\n\nRewritten:`;
		}
	}

	/**
	 * Rewrite character metadata using Content LLM
	 */
	async rewriteContent({
		userId,
		type,
		input
	}: {
		userId: number;
		type: ContentType;
		input: string;
	}): Promise<string> {
		try {
			console.log(`📝 Content LLM rewriting ${type}...`);

			// Get user's Content LLM settings
			const settings = await contentLlmSettingsService.getUserSettings(userId);
			console.log(`📝 Using Content LLM settings:`, {
				provider: settings.provider,
				model: settings.model,
				temperature: settings.temperature
			});

			// Load prompt template
			const promptTemplate = await this.loadPrompt(type);

			// Replace {{input}} placeholder
			const prompt = promptTemplate.replace('{{input}}', input);

			// Call LLM
			const response = await this.callContentLLM({
				messages: [{ role: 'user', content: prompt }],
				settings,
				contentType: type
			});

			console.log(`📝 Content LLM finished rewriting ${type}`);
			return response.trim();
		} catch (error: any) {
			console.error(`❌ Content LLM failed to rewrite ${type}:`, error.message);
			throw error;
		}
	}

	/**
	 * Call Content LLM with specific settings
	 */
	private async callContentLLM({
		messages,
		settings,
		contentType = 'content'
	}: {
		messages: { role: string; content: string }[];
		settings: any;
		contentType?: string;
	}): Promise<string> {
		const result = await callLlm({
			messages,
			settings,
			logType: `content-${contentType}`,
			logCharacterName: 'Content LLM'
		});
		return result.content;
	}
}

export const contentLlmService = new ContentLlmService();
