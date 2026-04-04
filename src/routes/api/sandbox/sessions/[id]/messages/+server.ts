import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sandboxService } from '$lib/server/services/sandboxService';
import { worldService } from '$lib/server/services/worldService';
import { personaService } from '$lib/server/services/personaService';
import { llmService } from '$lib/server/services/llmService';
import { llmSettingsFileService } from '$lib/server/services/llmSettingsFileService';
import { llmLogService } from '$lib/server/services/llmLogService';
import { generateSandboxNarration } from '$lib/server/llm/sandboxNarration';
import { checkForLocationUpdate } from '$lib/server/services/gameMasterService';
import type { Message } from '$lib/server/db/schema';
import type { WorldLocation } from '$lib/types/sandbox';

// GET - Get session messages
export const GET: RequestHandler = async ({ params, cookies }) => {
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

		const messages = await sandboxService.getMessages(sessionId);
		return json({ messages });
	} catch (error) {
		console.error('Failed to get messages:', error);
		return json({ error: 'Failed to get messages' }, { status: 500 });
	}
};

// POST - Send a message
export const POST: RequestHandler = async ({ params, cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const sessionId = parseInt(params.id!);
	if (isNaN(sessionId)) {
		return json({ error: 'Invalid session ID' }, { status: 400 });
	}

	try {
		const { content } = await request.json();

		if (!content || !content.trim()) {
			return json({ error: 'Message content required' }, { status: 400 });
		}

		let session = await sandboxService.getSession(sessionId, parseInt(userId));
		if (!session) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		// Build location context based on mode
		let location: WorldLocation | null = null;
		if (session.mode === 'dynamic') {
			location = session.dynamicLocationName
				? { name: session.dynamicLocationName, description: session.dynamicLocationDescription || '', connections: [] }
				: { name: 'Unknown Location', description: '', connections: [] };
		} else {
			const world = await worldService.get(session.worldFile);
			if (!world) {
				return json({ error: 'World not found' }, { status: 404 });
			}
			location = worldService.getLocation(world, session.currentLocationId);
		}

		// Pick a random active character to respond
		const activeCharacters = await sandboxService.getActiveCharacters(sessionId);
		const character = activeCharacters.length > 0
			? activeCharacters[Math.floor(Math.random() * activeCharacters.length)]
			: null;
		const userInfo = await personaService.getActiveUserInfo(parseInt(userId));

		// Add user message
		const userMessage = await sandboxService.addMessage(sessionId, parseInt(userId), {
			role: 'user',
			content: content.trim(),
			senderName: userInfo.name,
			senderAvatar: userInfo.avatarData
		});

		// Dynamic mode: check if location should update every 5 user messages
		if (session.mode === 'dynamic') {
			const userMessageCount = await sandboxService.getUserMessageCount(sessionId);
			if (userMessageCount > 0 && userMessageCount % 5 === 0) {
				const existingMessages = await sandboxService.getMessages(sessionId);
				const recentMessages = existingMessages.slice(-10).map(m => ({
					role: m.role,
					content: m.content,
					senderName: m.senderName
				}));

				const gmResult = await checkForLocationUpdate(
					location?.name || 'Unknown Location',
					location?.description || '',
					recentMessages,
					session.dynamicTheme
				);

				if (gmResult.shouldUpdate && gmResult.newLocation) {
					await sandboxService.updateDynamicLocation(
						sessionId, parseInt(userId),
						gmResult.newLocation.name,
						gmResult.newLocation.description
					);

					// Add narrator transition message
					await sandboxService.addMessage(sessionId, parseInt(userId), {
						role: 'narrator',
						content: `The scene shifts... You find yourself in **${gmResult.newLocation.name}**. ${gmResult.newLocation.description}`,
						senderName: 'Narrator'
					});

					// Update location context for the character response
					location = { name: gmResult.newLocation.name, description: gmResult.newLocation.description, connections: [] };

					// Re-fetch session for updated state
					session = (await sandboxService.getSession(sessionId, parseInt(userId)))!;
				}
			}
		}

		let assistantMessage: Message | null = null;

		if (character) {
			// Generate character response
			const response = await generateCharacterResponse(
				parseInt(userId),
				session,
				sessionId,
				character,
				location,
				userInfo.name,
				content.trim()
			);

			assistantMessage = await sandboxService.addMessage(sessionId, parseInt(userId), {
				role: 'assistant',
				content: response.content,
				characterId: character.id,
				senderName: character.name,
				senderAvatar: character.thumbnailData || character.imageData,
				reasoning: response.reasoning
			});
		} else {
			// No character - narrator responds
			const narration = await generateSandboxNarration({
				userId: parseInt(userId),
				locationType: 'explore',
				locationName: location?.name || 'Unknown Location',
				locationDescription: location?.description || '',
				userName: userInfo.name,
				userDescription: userInfo.description || '',
				character: null,
				history: content.trim()
			});

			assistantMessage = await sandboxService.addMessage(sessionId, parseInt(userId), {
				role: 'narrator',
				content: narration.content,
				senderName: 'Narrator',
				reasoning: narration.reasoning
			});
		}

		// Get updated messages
		const messages = await sandboxService.getMessages(sessionId);

		// Include current location in response so client can update sidebar
		const currentLocation = session.mode === 'dynamic'
			? { name: session.dynamicLocationName || '', description: session.dynamicLocationDescription || '', connections: [] }
			: location;

		return json({
			userMessage,
			assistantMessage,
			messages,
			location: currentLocation
		});
	} catch (error) {
		console.error('Failed to send message:', error);
		return json({ error: 'Failed to send message' }, { status: 500 });
	}
};

/**
 * Generate a character response for sandbox chat
 */
async function generateCharacterResponse(
	userId: number,
	session: typeof import('$lib/server/db/schema').sandboxSessions.$inferSelect,
	sessionId: number,
	character: typeof import('$lib/server/db/schema').characters.$inferSelect,
	location: import('$lib/types/sandbox').WorldLocation | null,
	userName: string,
	userMessage: string
): Promise<{ content: string; reasoning: string | null }> {
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

	// Build system prompt
	const systemPrompt = `You are ${character.name} in a sandbox exploration scene.

Location: ${location?.name || 'Unknown'}
${location?.description || ''}

Character: ${character.name}
${character.description || characterData.description || ''}

You have just encountered ${userName} at this location. Respond as ${character.name} would, staying in character. Keep your response concise (2-4 sentences).`;

	// Build messages for LLM
	const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
		{ role: 'system', content: systemPrompt },
		{ role: 'system', content: '[CONVERSATION HISTORY]' },
		...historyMessages,
		{ role: 'user', content: userMessage }
	];

	// Log prompt
	const logId = llmLogService.savePromptLog(formattedMessages, 'sandbox_chat', character.name, userName);

	// Call LLM
	const response = await llmService.createChatCompletion({
		messages: formattedMessages,
		userId,
		model: settings.model,
		temperature: settings.temperature,
		maxTokens: settings.maxTokens
	});

	// Log response
	llmLogService.saveResponseLog(response.content, response.content, 'sandbox_chat', logId, response);

	return {
		content: response.content,
		reasoning: response.reasoning || null
	};
}
