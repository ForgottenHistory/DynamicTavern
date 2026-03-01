import fs from 'fs/promises';
import path from 'path';
import { llmService } from '../services/llmService';
import { llmLogService } from '../services/llmLogService';
import { contentLlmSettingsService } from '../services/contentLlmSettingsService';
import { logger } from '../utils/logger';
import type { ChatCompletionResult } from './chatGeneration';

const PROMPTS_DIR = path.join(process.cwd(), 'data', 'prompts');

const DEFAULT_SANDBOX_LOCATION_PROMPT = `You are a narrator describing a location in a sandbox exploration mode.

Location: {{location_name}}
{{location_description}}

{{#if character}}
{{character_name}} is here.
{{character_description}}
{{/if}}

Player: {{user}}

Describe what {{user}} sees as they enter {{location_name}} in 2-3 sentences. Set the atmosphere.
{{#if character}}Include how {{character_name}} is present in this scene.{{/if}}`;

const DEFAULT_SANDBOX_EXPLORE_PROMPT = `You are a narrator for a sandbox exploration scene.

Location: {{location_name}}
{{location_description}}

{{#if character}}
{{character_name}} is here.
{{/if}}

Recent activity:
{{history}}

{{user}} looks around and explores. Describe something interesting they notice - an environmental detail, a sound, or something happening nearby. Keep it to 2-3 sentences.`;

export interface SandboxNarrationOptions {
	userId: number;
	locationType: 'enter' | 'explore';
	locationName: string;
	locationDescription: string;
	userName: string;
	character?: {
		name: string;
		description: string;
	} | null;
	history?: string;
}

/**
 * Process conditional blocks in template
 */
function processConditionals(template: string, variables: Record<string, any>): string {
	let result = template;

	// Process {{#if variable}}...{{/if}} blocks
	const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
	result = result.replace(ifRegex, (match, varName, content) => {
		const value = variables[varName];
		if (value && value !== '') {
			return content;
		}
		return '';
	});

	return result;
}

/**
 * Load sandbox prompt from file
 */
async function loadSandboxPrompt(type: 'enter' | 'explore'): Promise<string> {
	try {
		const filename = type === 'enter' ? 'sandbox_location.txt' : 'sandbox_explore.txt';
		const filePath = path.join(PROMPTS_DIR, filename);
		return await fs.readFile(filePath, 'utf-8');
	} catch {
		// File doesn't exist, return default
		return type === 'enter' ? DEFAULT_SANDBOX_LOCATION_PROMPT : DEFAULT_SANDBOX_EXPLORE_PROMPT;
	}
}

/**
 * Generate sandbox location narration
 */
export async function generateSandboxNarration(
	options: SandboxNarrationOptions
): Promise<ChatCompletionResult> {
	const { userId, locationType, locationName, locationDescription, userName, character, history } =
		options;

	// Get content LLM settings for narration
	const settings = contentLlmSettingsService.getSettings();

	// Load prompt template
	const basePrompt = await loadSandboxPrompt(locationType);

	// Build variables for conditional processing
	const variables: Record<string, any> = {
		location_name: locationName,
		location_description: locationDescription,
		user: userName,
		character: !!character,
		character_name: character?.name || '',
		character_description: character?.description || '',
		history: history || ''
	};

	// Process conditionals
	let narratorPrompt = processConditionals(basePrompt, variables);

	// Replace template variables
	narratorPrompt = narratorPrompt
		.replace(/\{\{location_name\}\}/g, locationName)
		.replace(/\{\{location_description\}\}/g, locationDescription)
		.replace(/\{\{user\}\}/g, userName)
		.replace(/\{\{character_name\}\}/g, character?.name || '')
		.replace(/\{\{character_description\}\}/g, character?.description || '')
		.replace(/\{\{history\}\}/g, history || '');

	// Format as system message
	const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
		{
			role: 'system',
			content: narratorPrompt.trim()
		}
	];

	// Log prompt for debugging
	const logId = llmLogService.savePromptLog(
		formattedMessages,
		'sandbox_narration',
		'Narrator',
		userName
	);

	logger.info(`Generating sandbox narration (${locationType})`, {
		location: locationName,
		user: userName,
		model: settings.model,
		hasCharacter: !!character
	});

	// Call LLM service
	const response = await llmService.createChatCompletion({
		messages: formattedMessages,
		userId,
		model: settings.model,
		temperature: settings.temperature,
		maxTokens: settings.maxTokens
	});

	logger.success(`Generated sandbox narration (${locationType})`, {
		location: locationName,
		model: response.model,
		contentLength: response.content.length,
		tokensUsed: response.usage?.total_tokens
	});

	// Log response for debugging
	llmLogService.saveResponseLog(
		response.content,
		response.content,
		'sandbox_narration',
		logId,
		response
	);

	return {
		content: response.content,
		reasoning: response.reasoning || null
	};
}
