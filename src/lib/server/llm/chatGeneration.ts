import { llmService } from '../services/llmService';
import { llmLogService } from '../services/llmLogService';
import { personaService } from '../services/personaService';
import { lorebookService } from '../services/lorebookService';
import { worldInfoService } from '../services/worldInfoService';
import { logger } from '../utils/logger';
import type { Message, Character, LlmSettings } from '../db/schema';
import type { LlmSettingsData } from '../services/llmSettingsFileService';
import {
	loadSystemPromptFromFile,
	loadWritingStyle,
	replaceTemplateVariables
} from './promptUtils';

// Union type that accepts both database and file-based settings
type LlmSettingsLike = LlmSettings | LlmSettingsData;

export interface ChatCompletionResult {
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
 * @param userId - User ID for persona lookup and lorebook context
 * @returns Generated assistant message content and reasoning
 */
export async function generateChatCompletion(
	conversationHistory: Message[],
	character: Character,
	settings: LlmSettingsLike,
	messageType: string = 'chat',
	conversationId?: number,
	scenarioOverride?: string | null,
	userId?: number
): Promise<ChatCompletionResult> {
	// Get userId from settings if not passed explicitly (for backwards compatibility)
	const effectiveUserId = userId ?? ('userId' in settings ? settings.userId : 0);
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
	const userInfo = await personaService.getActiveUserInfo(effectiveUserId);
	const userName = userInfo.name;

	// Load system prompt from file
	const basePrompt = await loadSystemPromptFromFile();

	// Get world info if conversation ID provided
	let worldText = '';
	let charMood = '';
	let charPosition = '';
	let charClothes = '';
	if (conversationId) {
		const worldInfo = await worldInfoService.getWorldInfo(conversationId);
		worldText = worldInfoService.formatWorldInfoForPrompt(worldInfo, character.name, userName);
		// Extract character attributes for template variables
		const charEntity = worldInfo?.worldState?.character;
		if (charEntity?.attributes) {
			for (const attr of charEntity.attributes) {
				if (attr.name === 'mood' && attr.type === 'text') charMood = attr.value as string;
				if (attr.name === 'position' && attr.type === 'text') charPosition = attr.value as string;
				if (attr.name === 'clothes' && attr.type === 'list' && Array.isArray(attr.value)) {
					charClothes = attr.value.map((item: { name: string; description: string }) => `${item.name}: ${item.description}`).join(', ');
				}
			}
		}
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
		writing_style: writingStyle,
		// World state variables for conditionals
		world_sidebar: !!(charMood || charPosition || charClothes),
		char_mood: charMood,
		char_position: charPosition,
		char_clothes: charClothes
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
		effectiveUserId,
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
		userId: effectiveUserId,
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
