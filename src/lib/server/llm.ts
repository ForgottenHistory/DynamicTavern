import { llmService } from './services/llmService';
import { llmLogService } from './services/llmLogService';
import { personaService } from './services/personaService';
import { lorebookService } from './services/lorebookService';
import { logger } from './utils/logger';
import type { Message, Character, LlmSettings } from './db/schema';
import fs from 'fs/promises';
import path from 'path';

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

const PROMPTS_DIR = path.join(process.cwd(), 'data', 'prompts');
const SYSTEM_PROMPT_FILE = path.join(PROMPTS_DIR, 'system.txt');
const IMPERSONATE_PROMPT_FILE = path.join(PROMPTS_DIR, 'impersonate.txt');

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
 * Load impersonate prompt from file
 */
async function loadImpersonatePromptFromFile(): Promise<string> {
	try {
		return await fs.readFile(IMPERSONATE_PROMPT_FILE, 'utf-8');
	} catch (error) {
		// File doesn't exist, return default
		return DEFAULT_IMPERSONATE_PROMPT;
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
	}
): string {
	return template
		.replace(/\{\{char\}\}/g, variables.char)
		.replace(/\{\{user\}\}/g, variables.user)
		.replace(/\{\{personality\}\}/g, variables.personality)
		.replace(/\{\{scenario\}\}/g, variables.scenario)
		.replace(/\{\{description\}\}/g, variables.description);
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
 * @returns Generated assistant message content and reasoning
 */
export async function generateChatCompletion(
	conversationHistory: Message[],
	character: Character,
	settings: LlmSettings,
	messageType: string = 'chat'
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

	// Prepare template variables
	const templateVariables = {
		char: character.name || 'Character',
		user: userName,
		personality: characterData.personality || '',
		scenario: characterData.scenario || '',
		description: characterData.description || ''
	};

	// Replace variables in template
	const systemPrompt = replaceTemplateVariables(basePrompt, templateVariables);

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

	// Format conversation history for LLM
	const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

	// Add system prompt
	formattedMessages.push({
		role: 'system',
		content: finalSystemPrompt.trim()
	});

	// Add conversation history
	for (const msg of conversationHistory) {
		formattedMessages.push({
			role: msg.role as 'user' | 'assistant',
			content: msg.content
		});
	}

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
 * @param settings - User's LLM settings
 * @returns Generated user message content
 */
export async function generateImpersonation(
	conversationHistory: Message[],
	character: Character,
	settings: LlmSettings
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
	const userInfo = await personaService.getActiveUserInfo(settings.userId);
	const userName = userInfo.name;

	// Load impersonate prompt from file
	const basePrompt = await loadImpersonatePromptFromFile();

	// Prepare template variables
	const templateVariables = {
		char: character.name || 'Character',
		user: userName,
		personality: characterData.personality || '',
		scenario: characterData.scenario || '',
		description: characterData.description || ''
	};

	// Replace variables in template
	let impersonatePrompt = replaceTemplateVariables(basePrompt, templateVariables);

	// Add lorebook/world info context based on conversation keywords
	const lorebookContext = await lorebookService.buildLorebookContext(
		settings.userId,
		character.id,
		conversationHistory.map((m) => ({ content: m.content }))
	);
	if (lorebookContext) {
		impersonatePrompt += `\n\n${lorebookContext}`;
	}

	// Format conversation history for LLM
	const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

	// Add impersonate prompt as system message
	formattedMessages.push({
		role: 'system',
		content: impersonatePrompt.trim()
	});

	// Add conversation history
	for (const msg of conversationHistory) {
		formattedMessages.push({
			role: msg.role as 'user' | 'assistant',
			content: msg.content
		});
	}

	// Log prompt for debugging
	const logId = llmLogService.savePromptLog(
		formattedMessages,
		'impersonate',
		character.name || 'Character',
		userName
	);

	logger.info(`Generating impersonation`, {
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

	logger.success(`Generated impersonation`, {
		character: character.name,
		model: response.model,
		contentLength: response.content.length,
		tokensUsed: response.usage?.total_tokens
	});

	// Log response for debugging
	llmLogService.saveResponseLog(response.content, response.content, 'impersonate', logId, response);

	return response.content;
}
