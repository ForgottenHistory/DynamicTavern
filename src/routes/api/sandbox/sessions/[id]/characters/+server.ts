import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { characters } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { sandboxService, formatWorldStateSummary } from '$lib/server/services/sandboxService';
import { sandboxParticipantService } from '$lib/server/services/sandboxParticipantService';
import { worldService } from '$lib/server/services/worldService';
import { generateSandboxNarration, generateCharacterEntranceDialogue, formatSandboxHistory } from '$lib/server/llm/sandboxNarration';
import { personaService } from '$lib/server/services/personaService';
import { decideOnCharacterEntered } from '$lib/server/services/gameMasterService';
import { sandboxImageService } from '$lib/server/services/sandboxImageService';
import { emitSandboxGmStatus, emitSandboxWorldState } from '$lib/server/socket';

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

		// Get location info for narration. Dynamic sessions have no world file —
		// the location lives on the session itself.
		let location: { name: string; description: string } | null = null;
		if (session.mode === 'dynamic') {
			if (session.dynamicLocationName) {
				location = {
					name: session.dynamicLocationName,
					description: session.dynamicLocationDescription || ''
				};
			}
		} else {
			const world = await worldService.get(session.worldFile);
			if (world) {
				const loc = worldService.getLocation(world, session.currentLocationId);
				if (loc) location = { name: loc.name, description: loc.description };
			}
		}

		// Generate character-spoken entrance beat (replaces the old narrator message)
		const userInfo = await personaService.getActiveUserInfo(parseInt(userId));
		const existingMessages = await sandboxService.getMessages(sessionId);
		const entrance = await generateCharacterEntranceDialogue({
			userId: parseInt(userId),
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

		// Add as an assistant (character) message
		await sandboxService.addMessage(sessionId, parseInt(userId), {
			role: 'assistant',
			content: entrance.content,
			characterId: character.id,
			senderName: character.name,
			senderAvatar: character.thumbnailData || character.imageData,
			reasoning: entrance.reasoning
		});

		// Get updated state
		const activeCharacters = await sandboxParticipantService.getActiveCharacters(sessionId);
		const allMessages = await sandboxService.getMessages(sessionId);

		// Ask the GM which (if any) scene-level actions to take for this entrance.
		// Fire-and-forget — we don't want to block the response on image generation.
		emitSandboxGmStatus(sessionId, true, 'Deciding on entrance beats');
		(async () => {
			try {
				const actions = await decideOnCharacterEntered({
					locationName: location?.name || session.currentLocationId,
					locationDescription: location?.description || '',
					characterName: character.name,
					characterDescription: character.description || '',
					worldStateSummary: formatWorldStateSummary(session.worldInfo)
				});

				for (const action of actions) {
					if (action.type === 'generate_image') {
						const pending = await sandboxImageService.createPending({
							sessionId,
							characterId: character.id,
							characterName: character.name,
							reason: action.reason
						});
						// Don't await — let the response return while SD churns.
						sandboxImageService
							.generateForCharacter({
								imageRowId: pending.id,
								sessionId,
								userId: parseInt(userId),
								characterId: character.id
							})
							.catch((err) => console.error('Background image generation failed:', err));
					} else if (action.type === 'refresh_world_state') {
						try {
							const fresh = await sandboxService.refreshWorldState(sessionId, parseInt(userId));
							if (fresh) {
								emitSandboxWorldState(sessionId, fresh);
							}
						} catch (err) {
							console.error('GM-driven world state refresh failed:', err);
						}
					}
				}
			} catch (err) {
				console.error('GM character-entry hook failed:', err);
			} finally {
				emitSandboxGmStatus(sessionId, false);
			}
		})();

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
			let location: { name: string; description: string } | null = null;
			if (session.mode === 'dynamic') {
				if (session.dynamicLocationName) {
					location = {
						name: session.dynamicLocationName,
						description: session.dynamicLocationDescription || ''
					};
				}
			} else {
				const world = await worldService.get(session.worldFile);
				if (world) {
					const loc = worldService.getLocation(world, session.currentLocationId);
					if (loc) location = { name: loc.name, description: loc.description };
				}
			}
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
