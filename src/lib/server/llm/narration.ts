import { llmService } from '../services/llmService';
import { llmLogService } from '../services/llmLogService';
import { personaService } from '../services/personaService';
import { worldInfoService } from '../services/worldInfoService';
import { sceneService } from '../services/sceneService';
import { contentLlmSettingsService } from '../services/contentLlmSettingsService';
import { logger } from '../utils/logger';
import { db } from '../db';
import { messages, conversations } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import type { Message, Character, LlmSettings } from '../db/schema';
import {
	loadNarrationPromptFromFile,
	loadWritingStyle,
	replaceTemplateVariables,
	type NarrationType
} from './promptUtils';
import type { ChatCompletionResult } from './chatGeneration';

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

	// Build character descriptions block
	const characterDescriptions = activeCharacters.map((char) => {
		let cardData: any = {};
		try {
			cardData = JSON.parse(char.cardData);
			if (cardData.data) cardData = cardData.data;
		} catch { /* ignore */ }
		const desc = char.description || cardData.description || '';
		const personality = cardData.personality || '';
		return `${char.name}: ${desc}${personality ? ` Personality: ${personality}` : ''}`;
	}).join('\n\n');

	// User description
	const userDescription = userInfo.description || '';

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
		.replace(/\{\{character_descriptions\}\}/g, characterDescriptions)
		.replace(/\{\{user\}\}/g, userName)
		.replace(/\{\{user_description\}\}/g, userDescription)
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
