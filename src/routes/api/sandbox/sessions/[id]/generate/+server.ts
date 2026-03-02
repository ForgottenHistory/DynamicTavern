import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sandboxService } from '$lib/server/services/sandboxService';
import { worldService } from '$lib/server/services/worldService';
import { personaService } from '$lib/server/services/personaService';
import { llmService } from '$lib/server/services/llmService';
import { llmSettingsFileService } from '$lib/server/services/llmSettingsFileService';
import { llmLogService } from '$lib/server/services/llmLogService';

// POST - Generate character response without user input
export const POST: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const sessionId = parseInt(params.id!);
	if (isNaN(sessionId)) {
		return json({ error: 'Invalid session ID' }, { status: 400 });
	}

	try {
		const session = await sandboxService.getSession(sessionId, parseInt(userId));
		if (!session) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		// Pick a random active character to generate response
		const activeCharacters = await sandboxService.getActiveCharacters(sessionId);
		const character = activeCharacters.length > 0
			? activeCharacters[Math.floor(Math.random() * activeCharacters.length)]
			: null;
		if (!character) {
			return json({ error: 'No character present to generate response' }, { status: 400 });
		}

		const world = await worldService.get(session.worldFile);
		if (!world) {
			return json({ error: 'World not found' }, { status: 404 });
		}

		const location = worldService.getLocation(world, session.currentLocationId);
		const userInfo = await personaService.getActiveUserInfo(parseInt(userId));

		// Get LLM settings
		const settings = llmSettingsFileService.getSettings('chat');

		// Parse character card data
		let characterData: any = {};
		try {
			characterData = JSON.parse(character.cardData);
			if (characterData.data) {
				characterData = characterData.data;
			}
		} catch {
			// ignore parse errors
		}

		// Get existing messages for context
		const existingMessages = await sandboxService.getMessages(sessionId);

		// Build conversation history
		const historyMessages = existingMessages.map((msg) => ({
			role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
			content: msg.content
		}));

		// Build system prompt for unprompted character action
		const systemPrompt = `You are ${character.name} in a sandbox exploration scene.

Location: ${location?.name || 'Unknown'}
${location?.description || ''}

Character: ${character.name}
${character.description || characterData.description || ''}

${userInfo.name} is here with you. Generate a brief action, observation, or dialogue from ${character.name} that would naturally occur in this moment. This could be:
- A comment about the location
- An action or gesture
- Starting a conversation
- Reacting to something in the environment

Keep it to 1-3 sentences. Write only as ${character.name}.`;

		// Build messages for LLM
		const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
			{ role: 'system', content: systemPrompt },
			{ role: 'system', content: '[CONVERSATION HISTORY]' },
			...historyMessages
		];

		// Log prompt
		const logId = llmLogService.savePromptLog(
			formattedMessages,
			'sandbox_generate',
			character.name,
			userInfo.name
		);

		// Call LLM
		const response = await llmService.createChatCompletion({
			messages: formattedMessages,
			userId: parseInt(userId),
			model: settings.model,
			temperature: settings.temperature,
			maxTokens: settings.maxTokens
		});

		// Log response
		llmLogService.saveResponseLog(
			response.content,
			response.content,
			'sandbox_generate',
			logId,
			response
		);

		// Add message to session
		const message = await sandboxService.addMessage(sessionId, parseInt(userId), {
			role: 'assistant',
			content: response.content,
			characterId: character.id,
			senderName: character.name,
			senderAvatar: character.thumbnailData || character.imageData,
			reasoning: response.reasoning || null
		});

		// Get updated messages
		const messages = await sandboxService.getMessages(sessionId);

		return json({
			message,
			messages
		});
	} catch (error) {
		console.error('Failed to generate:', error);
		return json({ error: 'Failed to generate response' }, { status: 500 });
	}
};
