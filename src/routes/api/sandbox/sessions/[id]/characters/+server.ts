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

// GET - List all user's characters (for the picker), filtering out already-present ones
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
		// Verify session ownership
		const session = await sandboxService.getSession(sessionId, parseInt(userId));
		if (!session) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		const userCharacters = await db
			.select({
				id: characters.id,
				name: characters.name,
				description: characters.description,
				thumbnailData: characters.thumbnailData,
				imageData: characters.imageData
			})
			.from(characters)
			.where(eq(characters.userId, parseInt(userId)));

		// Filter out characters already in the scene
		const activeCharacters = await sandboxParticipantService.getActiveCharacters(sessionId);
		const activeIds = new Set(activeCharacters.map((c) => c.id));
		const available = userCharacters.filter((c) => !activeIds.has(c.id));

		return json({ characters: available });
	} catch (error) {
		console.error('Failed to list characters:', error);
		return json({ error: 'Failed to list characters' }, { status: 500 });
	}
};

// POST - Add a character to the scene
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
		const { characterId } = await request.json();
		if (!characterId) {
			return json({ error: 'Character ID required' }, { status: 400 });
		}

		// Verify session ownership
		const session = await sandboxService.getSession(sessionId, parseInt(userId));
		if (!session) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		// Verify character ownership
		const [character] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, characterId))
			.limit(1);

		if (!character || character.userId !== parseInt(userId)) {
			return json({ error: 'Character not found' }, { status: 404 });
		}

		// Add to participants
		await sandboxParticipantService.addCharacterToScene(sessionId, characterId);

		// Also set as currentCharacterId (legacy field)
		await sandboxService.setCurrentCharacter(sessionId, parseInt(userId), characterId);

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
		const activeCharacters = await sandboxParticipantService.getActiveCharacters(sessionId);
		const allMessages = await sandboxService.getMessages(sessionId);

		return json({
			characters: activeCharacters,
			messages: allMessages
		});
	} catch (error) {
		console.error('Failed to add character:', error);
		return json({ error: 'Failed to add character' }, { status: 500 });
	}
};

// DELETE - Remove a character from the scene
export const DELETE: RequestHandler = async ({ params, cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const sessionId = parseInt(params.id!);
	if (isNaN(sessionId)) {
		return json({ error: 'Invalid session ID' }, { status: 400 });
	}

	try {
		const { characterId } = await request.json();
		if (!characterId) {
			return json({ error: 'Character ID required' }, { status: 400 });
		}

		// Verify session ownership
		const session = await sandboxService.getSession(sessionId, parseInt(userId));
		if (!session) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		// Verify character is in scene
		const inScene = await sandboxParticipantService.isCharacterInScene(sessionId, characterId);
		if (!inScene) {
			return json({ error: 'Character not in scene' }, { status: 400 });
		}

		// Get character info for narration before removing
		const [character] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, characterId))
			.limit(1);

		// Remove from participants
		await sandboxParticipantService.removeCharacterFromScene(sessionId, characterId);

		// Generate narrator departure message
		if (character) {
			const world = await worldService.get(session.worldFile);
			const location = world ? worldService.getLocation(world, session.currentLocationId) : null;
			const userInfo = await personaService.getActiveUserInfo(parseInt(userId));
			const existingMessages = await sandboxService.getMessages(sessionId);

			const narration = await generateSandboxNarration({
				userId: parseInt(userId),
				locationType: 'character_leave',
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

			await sandboxService.addMessage(sessionId, parseInt(userId), {
				role: 'narrator',
				content: narration.content,
				senderName: 'Narrator',
				reasoning: narration.reasoning
			});
		}

		// Update currentCharacterId to first remaining active character (or null)
		const activeCharacters = await sandboxParticipantService.getActiveCharacters(sessionId);
		const newCurrentId = activeCharacters.length > 0 ? activeCharacters[0].id : null;
		await sandboxService.setCurrentCharacter(sessionId, parseInt(userId), newCurrentId);

		const allMessages = await sandboxService.getMessages(sessionId);

		return json({
			characters: activeCharacters,
			messages: allMessages
		});
	} catch (error) {
		console.error('Failed to remove character:', error);
		return json({ error: 'Failed to remove character' }, { status: 500 });
	}
};
