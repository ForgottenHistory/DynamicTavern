import { llmService } from '../services/llmService';
import { llmLogService } from '../services/llmLogService';
import { personaService } from '../services/personaService';
import { lorebookService } from '../services/lorebookService';
import { worldInfoService } from '../services/worldInfoService';
import { logger } from '../utils/logger';
import type { Message, Character, LlmSettings } from '../db/schema';
import type { LlmSettingsData } from '../services/llmSettingsFileService';
import type { ImpersonateStyle } from '$lib/types/chat';
import {
	loadImpersonatePromptFromFile,
	loadWritingStyle,
	replaceTemplateVariables
} from './promptUtils';

// Type that accepts both old DB-based settings and new file-based settings
type LlmSettingsLike = LlmSettings | LlmSettingsData;

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
