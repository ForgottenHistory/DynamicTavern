import { llmService } from './services/llmService';
import { llmLogService } from './services/llmLogService';
import { personaService } from './services/personaService';
import { lorebookService } from './services/lorebookService';
import { worldInfoService } from './services/worldInfoService';
import { sceneService } from './services/sceneService';
import { contentLlmSettingsService } from './services/contentLlmSettingsService';
import { logger } from './utils/logger';
import { db } from './db';
import { messages, conversations } from './db/schema';
import { eq, desc } from 'drizzle-orm';
import type { Message, Character, LlmSettings } from './db/schema';
import type { LlmSettingsData } from './services/llmSettingsFileService';
import type { ImpersonateStyle } from '$lib/types/chat';
import fs from 'fs/promises';
import path from 'path';

// Type that accepts both old DB-based settings and new file-based settings
type LlmSettingsLike = LlmSettings | LlmSettingsData;

/**
 * Default system prompt used when file doesn't exist
 */
const DEFAULT_SYSTEM_PROMPT = `You are {{char}}.

{{description}}

Personality: {{personality}}

Scenario: {{scenario}}

Write your next reply as {{char}} in this roleplay chat with {{user}}.`;

const DEFAULT_IMPERSONATE_PROMPT = `Write the next message as {{user}} in this roleplay chat with {{char}}.

Stay in character as {{user}}. Write a natural response that fits the conversation flow.`;

const DEFAULT_NARRATION_PROMPTS: Record<string, string> = {
	look_character: `You are a narrator. Briefly describe {{char}}'s current appearance and expression. Keep it to 2-3 sentences.`,
	look_scene: `You are a narrator. Briefly describe the current environment. Keep it to 2-3 sentences.`,
	narrate: `You are a narrator. Briefly describe what is happening in the scene. Keep it to 2-3 sentences.`,
	look_item: `You are a narrator. Briefly describe {{item_owner}}'s {{item_name}} in detail. Keep it to 2-3 sentences.`,
	enter_scene: `You are a narrator. {{character_name}} has just entered the scene. Briefly describe their entrance in 1-2 sentences. Be dramatic but concise.`,
	leave_scene: `You are a narrator. {{character_name}} is leaving the scene. Briefly describe their departure in 1-2 sentences. Be natural and concise.`,
	scene_intro: `You are a narrator setting the stage for a roleplay scene. The following characters are present: {{character_names}}. Briefly describe the scene opening in 2-3 sentences. Set the atmosphere and describe the setting.`
};

const PROMPTS_DIR = path.join(process.cwd(), 'data', 'prompts');
const SYSTEM_PROMPT_FILE = path.join(PROMPTS_DIR, 'chat_system.txt');
const IMPERSONATE_PROMPT_FILE = path.join(PROMPTS_DIR, 'chat_impersonate.txt');

/**
 * Load system prompt from file
 */
async function loadSystemPromptFromFile(): Promise<string> {
	try {
		return await fs.readFile(SYSTEM_PROMPT_FILE, 'utf-8');
	} catch (error) {
		// File doesn't exist, return default
		return DEFAULT_SYSTEM_PROMPT;
	}
}

/**
 * Load impersonate prompt from file based on style
 */
async function loadImpersonatePromptFromFile(style: ImpersonateStyle = 'impersonate'): Promise<string> {
	try {
		// For 'impersonate' style, use the default file; for others, use style-specific files
		const filename = style === 'impersonate' ? 'chat_impersonate.txt' : `impersonate_${style}.txt`;
		const filePath = path.join(PROMPTS_DIR, filename);
		return await fs.readFile(filePath, 'utf-8');
	} catch (error) {
		// File doesn't exist, return default
		return DEFAULT_IMPERSONATE_PROMPT;
	}
}

const WRITING_STYLE_FILE = path.join(PROMPTS_DIR, 'writing_style.txt');

/**
 * Load writing style from file
 */
async function loadWritingStyle(): Promise<string> {
	try {
		return await fs.readFile(WRITING_STYLE_FILE, 'utf-8');
	} catch (error) {
		// File doesn't exist, return empty
		return '';
	}
}

/**
 * Replace template variables with actual values
 */
function replaceTemplateVariables(
	template: string,
	variables: {
		char: string;
		user: string;
		personality: string;
		scenario: string;
		description: string;
		world?: string;
		post_history?: string;
		writing_style?: string;
	}
): string {
	return template
		.replace(/\{\{char\}\}/g, variables.char)
		.replace(/\{\{user\}\}/g, variables.user)
		.replace(/\{\{personality\}\}/g, variables.personality)
		.replace(/\{\{scenario\}\}/g, variables.scenario)
		.replace(/\{\{description\}\}/g, variables.description)
		.replace(/\{\{world\}\}/g, variables.world || '')
		.replace(/\{\{post_history\}\}/g, variables.post_history || '')
		.replace(/\{\{writing_style\}\}/g, variables.writing_style || '');
}

interface ChatCompletionResult {
	content: string;
	reasoning: string | null;
}

/**
 * Generate a chat completion for a character conversation
 * @param conversationHistory - Array of previous messages in the conversation
 * @param character - Character card data
 * @param settings - User's LLM settings
 * @param messageType - Type of message for logging ('chat', 'regenerate', 'swipe')
 * @param conversationId - Optional conversation ID for world info lookup
 * @param scenarioOverride - Optional scenario override from conversation (takes precedence over character card)
 * @returns Generated assistant message content and reasoning
 */
export async function generateChatCompletion(
	conversationHistory: Message[],
	character: Character,
	settings: LlmSettings,
	messageType: string = 'chat',
	conversationId?: number,
	scenarioOverride?: string | null
): Promise<ChatCompletionResult> {
	// Parse character card data
	let characterData: any = {};
	try {
		characterData = JSON.parse(character.cardData);
		// Handle both v1 and v2 character card formats
		if (characterData.data) {
			characterData = characterData.data;
		}
	} catch (error) {
		console.error('Failed to parse character card data:', error);
		throw new Error('Invalid character card data');
	}

	// Get active user info (persona or default profile)
	const userInfo = await personaService.getActiveUserInfo(settings.userId);
	const userName = userInfo.name;

	// Load system prompt from file
	const basePrompt = await loadSystemPromptFromFile();

	// Get world info if conversation ID provided
	let worldText = '';
	if (conversationId) {
		const worldInfo = await worldInfoService.getWorldInfo(conversationId);
		worldText = worldInfoService.formatWorldInfoForPrompt(worldInfo, character.name, userName);
	}

	// Get writing style from file
	const writingStyle = await loadWritingStyle();

	// Format conversation history as text
	const historyText = conversationHistory
		.map((msg) => {
			const name = msg.role === 'user' ? userName : (msg.role === 'system' ? 'System' : character.name);
			return `${name}: ${msg.content}`;
		})
		.join('\n\n');

	// Prepare template variables
	// Use character.description (top-level) if available, otherwise fall back to cardData.description
	// Use scenarioOverride if provided, otherwise fall back to character card scenario
	const templateVariables = {
		char: character.name || 'Character',
		user: userName,
		personality: characterData.personality || '',
		scenario: scenarioOverride || characterData.scenario || '',
		description: character.description || characterData.description || '',
		world: worldText,
		post_history: character.postHistory || '',
		writing_style: writingStyle
	};

	// Replace variables in template
	let systemPrompt = replaceTemplateVariables(basePrompt, templateVariables);
	// Replace history variable
	systemPrompt = systemPrompt.replace(/\{\{history\}\}/g, historyText);

	// Add example dialogues if present (after template)
	let finalSystemPrompt = systemPrompt;
	if (characterData.mes_example) {
		finalSystemPrompt += `\n\nExample Dialogue:\n${characterData.mes_example}`;
	}

	// Add custom system prompt if present (after everything)
	if (characterData.system_prompt) {
		finalSystemPrompt += `\n\n${characterData.system_prompt}`;
	}

	// Add lorebook/world info context based on conversation keywords
	const lorebookContext = await lorebookService.buildLorebookContext(
		settings.userId,
		character.id,
		conversationHistory.map((m) => ({ content: m.content }))
	);
	if (lorebookContext) {
		finalSystemPrompt += `\n\n${lorebookContext}`;
	}

	// Format as system message
	const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
		{
			role: 'system',
			content: finalSystemPrompt.trim()
		}
	];

	// Log prompt for debugging (keep last 5 per type)
	const logId = llmLogService.savePromptLog(
		formattedMessages,
		messageType,
		character.name || 'Character',
		userName
	);

	logger.info(`Generating ${messageType} completion`, {
		character: character.name,
		user: userName,
		model: settings.model,
		messageCount: formattedMessages.length
	});

	// Call LLM service with user settings
	const response = await llmService.createChatCompletion({
		messages: formattedMessages,
		userId: settings.userId,
		model: settings.model,
		temperature: settings.temperature,
		maxTokens: settings.maxTokens
	});

	logger.success(`Generated ${messageType} completion`, {
		character: character.name,
		model: response.model,
		contentLength: response.content.length,
		reasoningLength: response.reasoning?.length || 0,
		tokensUsed: response.usage?.total_tokens
	});

	// Log response for debugging (matching ID to prompt)
	llmLogService.saveResponseLog(response.content, response.content, messageType, logId, response);

	return {
		content: response.content,
		reasoning: response.reasoning || null
	};
}

/**
 * Generate an impersonation message (AI writes as the user)
 * @param conversationHistory - Array of previous messages in the conversation
 * @param character - Character card data
 * @param settings - LLM settings
 * @param style - Impersonation style (serious, sarcastic, flirty, or impersonate)
 * @param userId - User ID for persona/lorebook lookup
 * @param conversationId - Optional conversation ID for world info lookup
 * @param scenarioOverride - Optional scenario override from conversation (takes precedence over character card)
 * @returns Generated user message content
 */
export async function generateImpersonation(
	conversationHistory: Message[],
	character: Character,
	settings: LlmSettingsLike,
	style: ImpersonateStyle = 'impersonate',
	userId?: number,
	conversationId?: number,
	scenarioOverride?: string | null
): Promise<string> {
	// Parse character card data
	let characterData: any = {};
	try {
		characterData = JSON.parse(character.cardData);
		// Handle both v1 and v2 character card formats
		if (characterData.data) {
			characterData = characterData.data;
		}
	} catch (error) {
		console.error('Failed to parse character card data:', error);
		throw new Error('Invalid character card data');
	}

	// Get active user info (persona or default profile)
	const resolvedUserId = userId ?? (settings as any).userId ?? 1;
	const userInfo = await personaService.getActiveUserInfo(resolvedUserId);
	const userName = userInfo.name;

	// Load impersonate prompt from file based on style
	const basePrompt = await loadImpersonatePromptFromFile(style);

	// Get world info if conversation ID provided
	let worldText = '';
	if (conversationId) {
		const worldInfo = await worldInfoService.getWorldInfo(conversationId);
		worldText = worldInfoService.formatWorldInfoForPrompt(worldInfo, character.name, userName);
	}

	// Get writing style from file
	const writingStyle = await loadWritingStyle();

	// Format conversation history as text
	const historyText = conversationHistory
		.map((msg) => {
			const name = msg.role === 'user' ? userName : (msg.role === 'system' ? 'System' : character.name);
			return `${name}: ${msg.content}`;
		})
		.join('\n\n');

	// Prepare template variables
	// Use character.description (top-level) if available, otherwise fall back to cardData.description
	// Use scenarioOverride if provided, otherwise fall back to character card scenario
	const templateVariables = {
		char: character.name || 'Character',
		user: userName,
		personality: characterData.personality || '',
		scenario: scenarioOverride || characterData.scenario || '',
		description: character.description || characterData.description || '',
		world: worldText,
		post_history: character.postHistory || '',
		writing_style: writingStyle
	};

	// Replace variables in template
	let impersonatePrompt = replaceTemplateVariables(basePrompt, templateVariables);
	// Replace history variable
	impersonatePrompt = impersonatePrompt.replace(/\{\{history\}\}/g, historyText);

	// Add lorebook/world info context based on conversation keywords
	const lorebookContext = await lorebookService.buildLorebookContext(
		resolvedUserId,
		character.id,
		conversationHistory.map((m) => ({ content: m.content }))
	);
	if (lorebookContext) {
		impersonatePrompt += `\n\n${lorebookContext}`;
	}

	// Format as system message
	const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
		{
			role: 'system',
			content: impersonatePrompt.trim()
		}
	];

	// Log prompt for debugging
	const logId = llmLogService.savePromptLog(
		formattedMessages,
		'impersonate',
		character.name || 'Character',
		userName
	);

	logger.info(`Generating impersonation (${style})`, {
		character: character.name,
		user: userName,
		model: settings.model,
		style,
		messageCount: formattedMessages.length
	});

	// Call LLM service with settings
	const response = await llmService.createChatCompletion({
		messages: formattedMessages,
		model: settings.model,
		temperature: settings.temperature,
		maxTokens: settings.maxTokens
	});

	logger.success(`Generated impersonation`, {
		character: character.name,
		model: response.model,
		contentLength: response.content.length,
		tokensUsed: response.usage?.total_tokens
	});

	// Log response for debugging
	llmLogService.saveResponseLog(response.content, response.content, 'impersonate', logId, response);

	// Strip username prefix if present
	let content = response.content.trim();
	const userNamePattern = new RegExp(`^${userName}\\s*:\\s*`, 'i');
	content = content.replace(userNamePattern, '');

	return content;
}

export type NarrationType = 'look_character' | 'look_scene' | 'narrate' | 'look_item' | 'enter_scene' | 'leave_scene' | 'scene_intro';

export interface ItemContext {
	owner: string;
	itemName: string;
	itemDescription: string;
}

export interface SceneContext {
	characterName?: string;
	characterNames?: string[];
}

/**
 * Load narration prompt from file
 */
async function loadNarrationPromptFromFile(type: NarrationType): Promise<string> {
	try {
		const filePath = path.join(PROMPTS_DIR, `action_${type}.txt`);
		return await fs.readFile(filePath, 'utf-8');
	} catch (error) {
		// File doesn't exist, return default
		return DEFAULT_NARRATION_PROMPTS[type] || DEFAULT_NARRATION_PROMPTS.narrate;
	}
}

/**
 * Generate a scene narration (system perspective, not character)
 * @param conversationHistory - Array of previous messages in the conversation
 * @param character - Character card data
 * @param settings - User's LLM settings
 * @param narrateType - Type of narration to generate
 * @param conversationId - Optional conversation ID for world info lookup
 * @param itemContext - Optional item context for look_item action
 * @param scenarioOverride - Optional scenario override from conversation (takes precedence over character card)
 * @returns Generated narration content and reasoning
 */
export async function generateNarration(
	conversationHistory: Message[],
	character: Character,
	settings: LlmSettings,
	narrateType: NarrationType,
	conversationId?: number,
	itemContext?: ItemContext,
	scenarioOverride?: string | null
): Promise<ChatCompletionResult> {
	// Parse character card data
	let characterData: any = {};
	try {
		characterData = JSON.parse(character.cardData);
		if (characterData.data) {
			characterData = characterData.data;
		}
	} catch (error) {
		console.error('Failed to parse character card data:', error);
		throw new Error('Invalid character card data');
	}

	// Get active user info
	const userInfo = await personaService.getActiveUserInfo(settings.userId);
	const userName = userInfo.name;

	// Load narration prompt from file
	const basePrompt = await loadNarrationPromptFromFile(narrateType);

	// Get world info if conversation ID provided
	let worldText = '';
	if (conversationId) {
		const worldInfo = await worldInfoService.getWorldInfo(conversationId);
		worldText = worldInfoService.formatWorldInfoForPrompt(worldInfo, character.name, userName);
	}

	// Get writing style from file
	const writingStyle = await loadWritingStyle();

	// Format conversation history as text
	const historyText = conversationHistory
		.map((msg) => {
			const name = msg.role === 'user' ? userName : (msg.role === 'system' ? 'System' : character.name);
			return `${name}: ${msg.content}`;
		})
		.join('\n\n');

	// Prepare template variables
	// Use character.description (top-level) if available, otherwise fall back to cardData.description
	// Use scenarioOverride if provided, otherwise fall back to character card scenario
	const templateVariables = {
		char: character.name || 'Character',
		user: userName,
		personality: characterData.personality || '',
		scenario: scenarioOverride || characterData.scenario || '',
		description: character.description || characterData.description || '',
		world: worldText,
		post_history: character.postHistory || '',
		writing_style: writingStyle
	};

	// Replace variables in template
	let narratorPrompt = replaceTemplateVariables(basePrompt, templateVariables);
	// Replace history variable
	narratorPrompt = narratorPrompt.replace(/\{\{history\}\}/g, historyText);
	// Replace item context variables if present
	if (itemContext) {
		narratorPrompt = narratorPrompt
			.replace(/\{\{item_owner\}\}/g, itemContext.owner)
			.replace(/\{\{item_name\}\}/g, itemContext.itemName)
			.replace(/\{\{item_description\}\}/g, itemContext.itemDescription);
	}

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
		'action',
		character.name || 'Character',
		userName
	);

	logger.info(`Generating narration (${narrateType})`, {
		character: character.name,
		user: userName,
		model: settings.model,
		messageCount: formattedMessages.length
	});

	// Call LLM service
	const response = await llmService.createChatCompletion({
		messages: formattedMessages,
		userId: settings.userId,
		model: settings.model,
		temperature: settings.temperature,
		maxTokens: settings.maxTokens
	});

	logger.success(`Generated narration (${narrateType})`, {
		character: character.name,
		model: response.model,
		contentLength: response.content.length,
		tokensUsed: response.usage?.total_tokens
	});

	// Log response for debugging
	llmLogService.saveResponseLog(response.content, response.content, 'action', logId, response);

	return {
		content: response.content,
		reasoning: response.reasoning || null
	};
}

/**
 * Generate scene-based narration (simplified version for scene actions)
 * @param userId - User ID for settings lookup
 * @param conversationId - Conversation/scene ID
 * @param narrateType - Type of scene narration
 * @param sceneContext - Context for the narration (character name, etc.)
 * @returns Generated narration content and reasoning
 */
export async function generateSceneNarration(
	userId: number,
	conversationId: number,
	narrateType: NarrationType,
	sceneContext?: SceneContext
): Promise<ChatCompletionResult> {
	// Get content LLM settings for narration
	const settings = contentLlmSettingsService.getSettings();

	// Get conversation for scenario
	const [conversation] = await db
		.select()
		.from(conversations)
		.where(eq(conversations.id, conversationId))
		.limit(1);

	// Get active user info
	const userInfo = await personaService.getActiveUserInfo(userId);
	const userName = userInfo.name;

	// Get active characters in scene
	const activeCharacters = await sceneService.getActiveCharacters(conversationId);
	const characterNames = activeCharacters.map((c) => c.name).join(', ');

	// Get recent conversation history
	const recentMessages = await db
		.select()
		.from(messages)
		.where(eq(messages.conversationId, conversationId))
		.orderBy(desc(messages.createdAt))
		.limit(10);

	// Format history
	const historyText = recentMessages
		.reverse()
		.map((msg) => {
			let name = userName;
			if (msg.role === 'assistant') {
				name = msg.senderName || 'Character';
			} else if (msg.role === 'narrator') {
				name = 'Narrator';
			} else if (msg.role === 'system') {
				name = 'System';
			}
			return `${name}: ${msg.content}`;
		})
		.join('\n\n');

	// Get world info
	let worldText = '';
	const primaryChar = activeCharacters[0];
	if (primaryChar) {
		const worldInfo = await worldInfoService.getWorldInfo(conversationId);
		worldText = worldInfoService.formatWorldInfoForPrompt(worldInfo, primaryChar.name, userName);
	}

	// Load narration prompt from file
	const basePrompt = await loadNarrationPromptFromFile(narrateType);

	// Replace template variables
	let narratorPrompt = basePrompt
		.replace(/\{\{character_name\}\}/g, sceneContext?.characterName || '')
		.replace(/\{\{character_names\}\}/g, sceneContext?.characterNames?.join(', ') || characterNames)
		.replace(/\{\{user\}\}/g, userName)
		.replace(/\{\{world\}\}/g, worldText)
		.replace(/\{\{scenario\}\}/g, conversation?.scenario || '')
		.replace(/\{\{history\}\}/g, historyText);

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
		'scene_narration',
		'Narrator',
		userName
	);

	logger.info(`Generating scene narration (${narrateType})`, {
		user: userName,
		model: settings.model,
		activeCharacters: characterNames
	});

	// Call LLM service
	const response = await llmService.createChatCompletion({
		messages: formattedMessages,
		userId,
		model: settings.model,
		temperature: settings.temperature,
		maxTokens: settings.maxTokens
	});

	logger.success(`Generated scene narration (${narrateType})`, {
		model: response.model,
		contentLength: response.content.length,
		tokensUsed: response.usage?.total_tokens
	});

	// Log response for debugging
	llmLogService.saveResponseLog(response.content, response.content, 'scene_narration', logId, response);

	return {
		content: response.content,
		reasoning: response.reasoning || null
	};
}
