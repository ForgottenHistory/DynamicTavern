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

The user's name is {{user}}.
{{#if user_description}}
{{user_description}}
{{/if}}

Describe what {{user}} sees as they enter {{location_name}} in 2-3 sentences. Set the atmosphere.
{{#if narration_style}}
Style: {{narration_style}}
{{/if}}`;

const DEFAULT_SANDBOX_CHARACTER_ENTER_PROMPT = `You are a narrator for a sandbox exploration scene.

Location: {{location_name}}
{{location_description}}

{{#if character}}
{{character_name}} has just arrived.
{{character_description}}
{{/if}}

The user's name is {{user}}.
{{#if user_description}}
{{user_description}}
{{/if}}

Describe {{character_name}} entering {{location_name}} and {{user}} noticing them. 1-2 sentences, set the tone for an encounter.`;

const DEFAULT_SANDBOX_CHARACTER_LEAVE_PROMPT = `You are a narrator for a sandbox exploration scene.

Location: {{location_name}}
{{location_description}}

{{#if character}}
{{character_name}} is leaving.
{{character_description}}
{{/if}}

The user's name is {{user}}.
{{#if user_description}}
{{user_description}}
{{/if}}

Describe {{character_name}} departing from {{location_name}} and {{user}} watching them leave. 1-2 sentences, brief and natural.`;

const DEFAULT_SANDBOX_EXPLORE_PROMPT = `You are a narrator for a sandbox exploration scene.

Location: {{location_name}}
{{location_description}}

{{#if character}}
{{character_name}} is here.
{{/if}}

The user's name is {{user}}.
{{#if user_description}}
{{user_description}}
{{/if}}

Recent activity:
{{history}}

{{user}} looks around and explores. Describe something interesting they notice - an environmental detail, a sound, or something happening nearby. Keep it to 2-3 sentences.`;

/**
 * Narration styles for location entries with a character present.
 * One is picked at random to add variety to scene introductions.
 */
const NARRATION_STYLES = [
	// Atmospheric - environment first, character in the backdrop
	`Focus on the atmosphere, mood, and environment of {{location_name}} first. {{character_name}} should be woven naturally into the setting as part of the scene.`,
	// Character-focused - lead with the character
	`Lead with {{character_name}} — their body language, expression, and what they're doing. The environment is secondary backdrop.`,
	// Sensory - sounds, smells, lighting
	`Emphasize sensory details — sounds, smells, lighting, temperature, textures. Weave {{character_name}}'s presence into the sensory landscape.`,
	// Action-in-progress - character mid-activity
	`{{character_name}} is in the middle of doing something when {{user}} arrives. Describe what they're caught doing and how the scene looks around them.`,
	// User perspective - what catches the eye
	`Write from {{user}}'s perspective — what catches their eye first, what draws their attention as they enter. Build toward noticing {{character_name}}.`,
	// Contrast/Tension - juxtaposition
	`Highlight a contrast or tension — between the environment and {{character_name}}'s presence, mood, or appearance. Something feels slightly unexpected or striking.`,
	// Character approaches - character initiates
	`{{character_name}} notices {{user}} entering and approaches or acknowledges them. Describe the character's initiative and how they engage.`
];

function getRandomNarrationStyle(characterName: string, userName: string, locationName: string): string {
	const style = NARRATION_STYLES[Math.floor(Math.random() * NARRATION_STYLES.length)];
	return style
		.replace(/\{\{character_name\}\}/g, characterName)
		.replace(/\{\{user\}\}/g, userName)
		.replace(/\{\{location_name\}\}/g, locationName);
}

export interface SandboxNarrationOptions {
	userId: number;
	locationType: 'enter' | 'explore' | 'character_enter' | 'character_leave';
	locationName: string;
	locationDescription: string;
	userName: string;
	userDescription?: string;
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
async function loadSandboxPrompt(type: 'enter' | 'explore' | 'character_enter' | 'character_leave'): Promise<string> {
	const filenameMap: Record<string, string> = {
		enter: 'sandbox_location.txt',
		explore: 'sandbox_explore.txt',
		character_enter: 'sandbox_character_enter.txt',
		character_leave: 'sandbox_character_leave.txt'
	};
	const defaultMap: Record<string, string> = {
		enter: DEFAULT_SANDBOX_LOCATION_PROMPT,
		explore: DEFAULT_SANDBOX_EXPLORE_PROMPT,
		character_enter: DEFAULT_SANDBOX_CHARACTER_ENTER_PROMPT,
		character_leave: DEFAULT_SANDBOX_CHARACTER_LEAVE_PROMPT
	};

	try {
		const filePath = path.join(PROMPTS_DIR, filenameMap[type]);
		return await fs.readFile(filePath, 'utf-8');
	} catch {
		return defaultMap[type];
	}
}

/**
 * Generate sandbox location narration
 */
export async function generateSandboxNarration(
	options: SandboxNarrationOptions
): Promise<ChatCompletionResult> {
	const { userId, locationType, locationName, locationDescription, userName, userDescription, character, history } =
		options;

	// Get content LLM settings for narration
	const settings = contentLlmSettingsService.getSettings();

	// Load prompt template
	const basePrompt = await loadSandboxPrompt(locationType);

	// Pick a random narration style for location entries with a character
	const narrationStyle = (locationType === 'enter' && character)
		? getRandomNarrationStyle(character.name, userName, locationName)
		: '';

	// Build variables for conditional processing
	const variables: Record<string, any> = {
		location_name: locationName,
		location_description: locationDescription,
		user: userName,
		user_description: userDescription || '',
		character: !!character,
		character_name: character?.name || '',
		character_description: character?.description || '',
		narration_style: narrationStyle,
		history: history || ''
	};

	// Process conditionals
	let narratorPrompt = processConditionals(basePrompt, variables);

	// Replace template variables
	narratorPrompt = narratorPrompt
		.replace(/\{\{location_name\}\}/g, locationName)
		.replace(/\{\{location_description\}\}/g, locationDescription)
		.replace(/\{\{user\}\}/g, userName)
		.replace(/\{\{user_description\}\}/g, userDescription || '')
		.replace(/\{\{character_name\}\}/g, character?.name || '')
		.replace(/\{\{character_description\}\}/g, character?.description || '')
		.replace(/\{\{narration_style\}\}/g, narrationStyle)
		.replace(/\{\{history\}\}/g, history || '');

	// Format as system + user message (user message required by many LLM providers)
	const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
		{
			role: 'system',
			content: narratorPrompt.trim()
		},
		{
			role: 'user',
			content: 'Narrate the scene.'
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
		hasCharacter: !!character,
		...(narrationStyle ? { narrationStyle } : {})
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
