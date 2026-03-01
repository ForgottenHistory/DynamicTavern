import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { messages, characters } from '$lib/server/db/schema';
import { eq, and, lt, asc } from 'drizzle-orm';
import { sandboxService } from '$lib/server/services/sandboxService';
import { worldService } from '$lib/server/services/worldService';
import { personaService } from '$lib/server/services/personaService';
import { llmService } from '$lib/server/services/llmService';
import { llmSettingsFileService } from '$lib/server/services/llmSettingsFileService';
import { llmLogService } from '$lib/server/services/llmLogService';
import { generateSandboxNarration } from '$lib/server/llm/sandboxNarration';

// POST - Regenerate a sandbox message (create new swipe variant)
export const POST: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const sessionId = parseInt(params.id!);
	const messageId = parseInt(params.messageId!);
	if (isNaN(sessionId) || isNaN(messageId)) {
		return json({ error: 'Invalid ID' }, { status: 400 });
	}

	try {
		// Verify ownership
		const session = await sandboxService.getSession(sessionId, parseInt(userId));
		if (!session) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		const [message] = await db
			.select()
			.from(messages)
			.where(
				and(
					eq(messages.id, messageId),
					eq(messages.sandboxSessionId, sessionId)
				)
			)
			.limit(1);

		if (!message) {
			return json({ error: 'Message not found' }, { status: 404 });
		}

		// Only allow regenerating assistant/narrator messages
		if (message.role !== 'assistant' && message.role !== 'narrator') {
			return json({ error: 'Can only regenerate assistant/narrator messages' }, { status: 400 });
		}

		const world = await worldService.get(session.worldFile);
		if (!world) {
			return json({ error: 'World not found' }, { status: 404 });
		}

		const location = worldService.getLocation(world, session.currentLocationId);
		const userInfo = await personaService.getActiveUserInfo(parseInt(userId));

		let newContent: string;
		let newReasoning: string | null = null;

		if (message.role === 'narrator') {
			// Regenerate narrator message
			const narration = await generateSandboxNarration({
				userId: parseInt(userId),
				locationType: 'enter',
				locationName: location?.name || session.currentLocationId,
				locationDescription: location?.description || '',
				userName: userInfo.name,
				userDescription: userInfo.description || '',
				character: session.currentCharacterId
					? await getCharacterInfo(session.currentCharacterId)
					: null
			});
			newContent = narration.content;
			newReasoning = narration.reasoning;
		} else {
			// Regenerate character response
			const character = message.characterId
				? await getCharacter(message.characterId)
				: await sandboxService.getCurrentCharacter(session);

			if (!character) {
				return json({ error: 'Character not found' }, { status: 404 });
			}

			// Get conversation history up to this message
			const history = await db
				.select()
				.from(messages)
				.where(
					and(
						eq(messages.sandboxSessionId, sessionId),
						lt(messages.id, messageId)
					)
				)
				.orderBy(asc(messages.createdAt), asc(messages.id));

			const result = await generateCharacterResponse(
				parseInt(userId),
				character,
				location,
				userInfo.name,
				history
			);
			newContent = result.content;
			newReasoning = result.reasoning;
		}

		// Parse existing swipes and reasoning arrays
		const swipes = message.swipes ? JSON.parse(message.swipes) : [message.content];
		const existingReasoning: (string | null)[] = message.reasoning
			? (() => { try { const arr = JSON.parse(message.reasoning!); return Array.isArray(arr) ? arr : new Array(swipes.length).fill(null); } catch { return new Array(swipes.length).fill(null); } })()
			: new Array(swipes.length).fill(null);

		// Add new variant
		swipes.push(newContent);
		existingReasoning.push(newReasoning);

		// Update message with new swipe
		await db
			.update(messages)
			.set({
				swipes: JSON.stringify(swipes),
				currentSwipe: swipes.length - 1,
				content: newContent,
				reasoning: JSON.stringify(existingReasoning)
			})
			.where(eq(messages.id, messageId));

		return json({ success: true, content: newContent, reasoning: newReasoning, swipeCount: swipes.length });
	} catch (error) {
		console.error('Failed to regenerate sandbox message:', error);
		return json({ error: 'Failed to regenerate message' }, { status: 500 });
	}
};

async function getCharacter(characterId: number) {
	const [character] = await db
		.select()
		.from(characters)
		.where(eq(characters.id, characterId))
		.limit(1);
	return character || null;
}

async function getCharacterInfo(characterId: number) {
	const character = await getCharacter(characterId);
	if (!character) return null;
	return { name: character.name, description: character.description || '' };
}

async function generateCharacterResponse(
	userId: number,
	character: typeof characters.$inferSelect,
	location: import('$lib/types/sandbox').WorldLocation | null,
	userName: string,
	history: typeof messages.$inferSelect[]
): Promise<{ content: string; reasoning: string | null }> {
	const settings = llmSettingsFileService.getSettings('chat');

	let characterData: any = {};
	try {
		characterData = JSON.parse(character.cardData);
		if (characterData.data) characterData = characterData.data;
	} catch { /* ignore */ }

	const historyMessages = history.map((msg) => ({
		role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
		content: msg.content
	}));

	const systemPrompt = `You are ${character.name} in a sandbox exploration scene.

Location: ${location?.name || 'Unknown'}
${location?.description || ''}

Character: ${character.name}
${character.description || characterData.description || ''}

You have just encountered ${userName} at this location. Respond as ${character.name} would, staying in character. Keep your response concise (2-4 sentences).`;

	const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
		{ role: 'system', content: systemPrompt },
		{ role: 'system', content: '[CONVERSATION HISTORY]' },
		...historyMessages
	];

	const logId = llmLogService.savePromptLog(formattedMessages, 'sandbox_regenerate', character.name, userName);

	const response = await llmService.createChatCompletion({
		messages: formattedMessages,
		userId,
		model: settings.model,
		temperature: settings.temperature,
		maxTokens: settings.maxTokens
	});

	llmLogService.saveResponseLog(response.content, response.content, 'sandbox_regenerate', logId, response);

	return { content: response.content, reasoning: response.reasoning || null };
}
