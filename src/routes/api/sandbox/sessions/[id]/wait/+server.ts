import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { characters } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { sandboxService } from '$lib/server/services/sandboxService';
import { sandboxParticipantService } from '$lib/server/services/sandboxParticipantService';
import { worldService } from '$lib/server/services/worldService';
import { generateSandboxNarration, formatSandboxHistory } from '$lib/server/llm/sandboxNarration';
import { personaService } from '$lib/server/services/personaService';

// POST - Wait: a random character joins the scene
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
		// Verify session ownership
		const session = await sandboxService.getSession(sessionId, parseInt(userId));
		if (!session) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		// Get all user's characters
		const userCharacters = await db
			.select()
			.from(characters)
			.where(eq(characters.userId, parseInt(userId)));

		// Filter out characters already in the scene
		const activeCharacters = await sandboxParticipantService.getActiveCharacters(sessionId);
		const activeIds = new Set(activeCharacters.map((c) => c.id));
		const available = userCharacters.filter((c) => !activeIds.has(c.id));

		if (available.length === 0) {
			return json({ error: 'No available characters to join' }, { status: 400 });
		}

		// Pick a random character
		const character = available[Math.floor(Math.random() * available.length)];

		// Add to participants
		await sandboxParticipantService.addCharacterToScene(sessionId, character.id);
		await sandboxService.setCurrentCharacter(sessionId, parseInt(userId), character.id);

		// Get location info for narration
		const world = await worldService.get(session.worldFile);
		const location = world ? worldService.getLocation(world, session.currentLocationId) : null;

		// Generate narrator entrance message
		const userInfo = await personaService.getActiveUserInfo(parseInt(userId));
		const existingMessages = await sandboxService.getMessages(sessionId);
		const narration = await generateSandboxNarration({
			userId: parseInt(userId),
			locationType: 'character_enter',
			locationName: location?.name || session.currentLocationId,
			locationDescription: location?.description || '',
			userName: userInfo.name,
			userDescription: userInfo.description || '',
			character: {
				name: character.name,
				description: character.description || ''
			},
			history: formatSandboxHistory(existingMessages)
		});

		// Add narrator message
		await sandboxService.addMessage(sessionId, parseInt(userId), {
			role: 'narrator',
			content: narration.content,
			senderName: 'Narrator',
			reasoning: narration.reasoning
		});

		// Get updated state
		const updatedCharacters = await sandboxParticipantService.getActiveCharacters(sessionId);
		const allMessages = await sandboxService.getMessages(sessionId);

		return json({
			characters: updatedCharacters,
			messages: allMessages
		});
	} catch (error) {
		console.error('Failed to wait:', error);
		return json({ error: 'Failed to wait' }, { status: 500 });
	}
};
