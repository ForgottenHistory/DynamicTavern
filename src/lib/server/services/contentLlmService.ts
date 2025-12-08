import { contentLlmSettingsService } from './contentLlmSettingsService';
import { callLlm } from './llmCallService';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_DIR = 'data/prompts';

export type ContentType = 'description' | 'personality' | 'scenario' | 'message_example' | 'greeting' | 'scenario_greeting';

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
	 * Generate a custom greeting based on a scenario
	 */
	async generateScenarioGreeting({
		characterName,
		characterDescription,
		characterPersonality,
		scenario,
		userName
	}: {
		characterName: string;
		characterDescription: string;
		characterPersonality: string;
		scenario: string;
		userName: string;
	}): Promise<string> {
		try {
			console.log(`📝 Content LLM generating scenario greeting for ${characterName}...`);

			// Get Content LLM settings from file
			const settings = contentLlmSettingsService.getSettings();

			// Load prompt template
			const promptTemplate = await this.loadPrompt('scenario_greeting');

			// Replace all placeholders
			const prompt = promptTemplate
				.replace(/\{\{char\}\}/gi, characterName)
				.replace(/\{\{description\}\}/gi, characterDescription || 'No description provided')
				.replace(/\{\{personality\}\}/gi, characterPersonality || 'No personality provided')
				.replace(/\{\{scenario\}\}/gi, scenario)
				.replace(/\{\{user\}\}/gi, userName);

			// Call LLM
			const response = await this.callContentLLM({
				messages: [{ role: 'user', content: prompt }],
				settings,
				contentType: 'scenario_greeting'
			});

			console.log(`📝 Content LLM finished generating scenario greeting`);
			return response.trim();
		} catch (error: any) {
			console.error(`❌ Content LLM failed to generate scenario greeting:`, error.message);
			throw error;
		}
	}

	/**
	 * Rewrite character metadata using Content LLM
	 */
	async rewriteContent({
		type,
		input
	}: {
		type: ContentType;
		input: string;
	}): Promise<string> {
		try {
			console.log(`📝 Content LLM rewriting ${type}...`);

			// Get Content LLM settings from file
			const settings = contentLlmSettingsService.getSettings();
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
