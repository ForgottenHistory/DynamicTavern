import { db } from '$lib/server/db';
import { sandboxSessions, messages, characters, type Character, type Message } from '$lib/server/db/schema';
import { eq, and, gte, asc, count } from 'drizzle-orm';
import { worldService } from './worldService';
import { sandboxParticipantService } from './sandboxParticipantService';
import type { World, LocationHistoryEntry } from '$lib/types/sandbox';

class SandboxService {
	/**
	 * Create a new sandbox session
	 */
	async createSession(
		userId: number,
		worldFile: string
	): Promise<{ session: typeof sandboxSessions.$inferSelect; world: World } | null> {
		const world = await worldService.get(worldFile);
		if (!world) return null;

		const [session] = await db
			.insert(sandboxSessions)
			.values({
				userId,
				worldFile,
				currentLocationId: world.startLocation
			})
			.returning();

		return { session, world };
	}

	/**
	 * Get a session by ID (validates user ownership)
	 */
	async getSession(
		sessionId: number,
		userId: number
	): Promise<typeof sandboxSessions.$inferSelect | null> {
		const [session] = await db
			.select()
			.from(sandboxSessions)
			.where(and(eq(sandboxSessions.id, sessionId), eq(sandboxSessions.userId, userId)))
			.limit(1);

		return session || null;
	}

	/**
	 * Get all sessions for a user
	 */
	async getUserSessions(userId: number): Promise<Array<typeof sandboxSessions.$inferSelect>> {
		return await db.select().from(sandboxSessions).where(eq(sandboxSessions.userId, userId));
	}

	/**
	 * Delete a session
	 */
	async deleteSession(sessionId: number, userId: number): Promise<boolean> {
		const result = await db
			.delete(sandboxSessions)
			.where(and(eq(sandboxSessions.id, sessionId), eq(sandboxSessions.userId, userId)));

		if (result.changes > 0) {
			// Clean up on-disk image files. Imported lazily to avoid a circular dep.
			const { sandboxImageService } = await import('./sandboxImageService');
			await sandboxImageService.deleteSessionFiles(sessionId);
		}

		return result.changes > 0;
	}

	/**
	 * Move to a new location in the world
	 */
	async moveToLocation(
		sessionId: number,
		userId: number,
		locationId: string
	): Promise<{
		session: typeof sandboxSessions.$inferSelect;
		characters: Character[];
	} | null> {
		const session = await this.getSession(sessionId, userId);
		if (!session) return null;

		const world = await worldService.get(session.worldFile);
		if (!world) return null;

		// Validate the move is allowed
		if (!worldService.canMoveTo(world, session.currentLocationId, locationId)) {
			return null;
		}

		// Deactivate all current participants
		await sandboxParticipantService.deactivateAll(sessionId);

		// Spawn a character at the new location
		const location = worldService.getLocation(world, locationId);
		const character = await this.spawnCharacter(
			userId,
			location?.characterFilters !== null,
			world.spawnChance
		);

		// Add spawned character to participants
		if (character) {
			await sandboxParticipantService.addCharacterToScene(sessionId, character.id);
		}

		// Update location
		const [updated] = await db
			.update(sandboxSessions)
			.set({
				currentLocationId: locationId,
				currentCharacterId: character?.id || null,
				updatedAt: new Date()
			})
			.where(and(eq(sandboxSessions.id, sessionId), eq(sandboxSessions.userId, userId)))
			.returning();

		const activeCharacters = await sandboxParticipantService.getActiveCharacters(sessionId);

		return { session: updated, characters: activeCharacters };
	}

	/**
	 * Spawn a random character at a location
	 */
	async spawnCharacter(
		userId: number,
		allowSpawn: boolean,
		spawnChance: number = 0.7
	): Promise<Character | null> {
		if (!allowSpawn) return null;

		// Flat random chance
		if (Math.random() > spawnChance) return null;

		// Get all user's characters and pick one at random
		const userCharacters = await db
			.select()
			.from(characters)
			.where(eq(characters.userId, userId));

		if (userCharacters.length === 0) return null;

		const randomIndex = Math.floor(Math.random() * userCharacters.length);
		return userCharacters[randomIndex];
	}

	/**
	 * Get messages for a sandbox session from the messages table
	 */
	async getMessages(sessionId: number): Promise<Message[]> {
		return await db
			.select()
			.from(messages)
			.where(eq(messages.sandboxSessionId, sessionId))
			.orderBy(asc(messages.createdAt), asc(messages.id));
	}

	/**
	 * Add a message to a sandbox session
	 */
	async addMessage(
		sessionId: number,
		userId: number,
		data: {
			role: string;
			content: string;
			characterId?: number | null;
			senderName?: string | null;
			senderAvatar?: string | null;
			reasoning?: string | null;
		}
	): Promise<Message | null> {
		// Verify session ownership
		const session = await this.getSession(sessionId, userId);
		if (!session) return null;

		const [newMessage] = await db
			.insert(messages)
			.values({
				sandboxSessionId: sessionId,
				conversationId: null,
				role: data.role,
				content: data.content,
				characterId: data.characterId ?? null,
				senderName: data.senderName ?? null,
				senderAvatar: data.senderAvatar ?? null,
				reasoning: data.reasoning ?? null,
				swipes: JSON.stringify([data.content]),
				currentSwipe: 0
			})
			.returning();

		// Update session timestamp
		await db
			.update(sandboxSessions)
			.set({ updatedAt: new Date() })
			.where(eq(sandboxSessions.id, sessionId));

		return newMessage;
	}

	/**
	 * Edit a message's content (with ownership verification via session)
	 */
	async editMessage(
		messageId: number,
		sessionId: number,
		userId: number,
		content: string
	): Promise<Message | null> {
		// Verify ownership
		const msg = await this.getVerifiedMessage(messageId, sessionId, userId);
		if (!msg) return null;

		// Update swipes array if it exists
		let updatedSwipes = msg.swipes;
		if (updatedSwipes) {
			try {
				const swipesArray = JSON.parse(updatedSwipes);
				if (Array.isArray(swipesArray)) {
					const currentIndex = msg.currentSwipe ?? 0;
					swipesArray[currentIndex] = content;
					updatedSwipes = JSON.stringify(swipesArray);
				}
			} catch {
				// If parsing fails, just update the content
			}
		}

		const [updated] = await db
			.update(messages)
			.set({ content, swipes: updatedSwipes })
			.where(eq(messages.id, messageId))
			.returning();

		return updated;
	}

	/**
	 * Delete a message and all messages after it in the session
	 */
	async deleteMessageAndAfter(
		messageId: number,
		sessionId: number,
		userId: number
	): Promise<boolean> {
		// Verify ownership
		const msg = await this.getVerifiedMessage(messageId, sessionId, userId);
		if (!msg) return false;

		await db
			.delete(messages)
			.where(
				and(
					eq(messages.sandboxSessionId, sessionId),
					gte(messages.id, messageId)
				)
			);

		return true;
	}

	/**
	 * Get a message and verify it belongs to the given session owned by the user
	 */
	private async getVerifiedMessage(
		messageId: number,
		sessionId: number,
		userId: number
	): Promise<Message | null> {
		// First verify the session belongs to the user
		const session = await this.getSession(sessionId, userId);
		if (!session) return null;

		const [msg] = await db
			.select()
			.from(messages)
			.where(
				and(
					eq(messages.id, messageId),
					eq(messages.sandboxSessionId, sessionId)
				)
			)
			.limit(1);

		return msg || null;
	}

	/**
	 * Update the current character for a session (also adds to participants if not present)
	 */
	async setCurrentCharacter(
		sessionId: number,
		userId: number,
		characterId: number | null
	): Promise<boolean> {
		if (characterId) {
			const inScene = await sandboxParticipantService.isCharacterInScene(sessionId, characterId);
			if (!inScene) {
				await sandboxParticipantService.addCharacterToScene(sessionId, characterId);
			}
		}

		const result = await db
			.update(sandboxSessions)
			.set({
				currentCharacterId: characterId,
				updatedAt: new Date()
			})
			.where(and(eq(sandboxSessions.id, sessionId), eq(sandboxSessions.userId, userId)));

		return result.changes > 0;
	}

	/**
	 * Get a random active character for a session.
	 * Falls back to currentCharacterId if no participants (legacy).
	 */
	async getCurrentCharacter(session: typeof sandboxSessions.$inferSelect): Promise<Character | null> {
		// Try participants first
		const activeChars = await sandboxParticipantService.getActiveCharacters(session.id);
		if (activeChars.length > 0) {
			return activeChars[Math.floor(Math.random() * activeChars.length)];
		}

		// Legacy fallback
		if (!session.currentCharacterId) return null;

		const [character] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, session.currentCharacterId))
			.limit(1);

		return character || null;
	}

	/**
	 * Get all active characters in a session
	 */
	async getActiveCharacters(sessionId: number): Promise<Character[]> {
		return sandboxParticipantService.getActiveCharacters(sessionId);
	}

	/**
	 * Create a dynamic sandbox session (no world file)
	 */
	async createDynamicSession(userId: number, theme?: string): Promise<typeof sandboxSessions.$inferSelect> {
		const [session] = await db
			.insert(sandboxSessions)
			.values({
				userId,
				mode: 'dynamic',
				worldFile: '_dynamic',
				currentLocationId: '_dynamic',
				dynamicTheme: theme || null
			})
			.returning();

		return session;
	}

	/**
	 * Update the dynamic location, saving the old one to history
	 */
	async updateDynamicLocation(
		sessionId: number,
		userId: number,
		name: string,
		description: string
	): Promise<void> {
		const session = await this.getSession(sessionId, userId);
		if (!session) return;

		// Append old location to history if it exists
		let history: LocationHistoryEntry[] = [];
		try {
			history = session.locationHistory ? JSON.parse(session.locationHistory) : [];
		} catch { /* ignore */ }

		if (session.dynamicLocationName) {
			history.push({
				name: session.dynamicLocationName,
				description: session.dynamicLocationDescription || '',
				enteredAt: session.updatedAt?.toISOString() || new Date().toISOString()
			});
		}

		await db
			.update(sandboxSessions)
			.set({
				dynamicLocationName: name,
				dynamicLocationDescription: description,
				locationHistory: JSON.stringify(history),
				updatedAt: new Date()
			})
			.where(and(eq(sandboxSessions.id, sessionId), eq(sandboxSessions.userId, userId)));
	}

	/**
	 * Count user messages in a session
	 */
	async getUserMessageCount(sessionId: number): Promise<number> {
		const [result] = await db
			.select({ count: count() })
			.from(messages)
			.where(and(eq(messages.sandboxSessionId, sessionId), eq(messages.role, 'user')));

		return result?.count || 0;
	}

	/**
	 * Regenerate world state for a session using the Content LLM. Returns the
	 * fresh state (also persisted to DB), or null on failure.
	 */
	async refreshWorldState(sessionId: number, userId: number): Promise<any | null> {
		const { clothesGenerationService } = await import('./clothesGenerationService');
		const { personaService } = await import('./personaService');

		const session = await this.getSession(sessionId, userId);
		if (!session) return null;

		const activeCharacters = await this.getActiveCharacters(sessionId);
		if (activeCharacters.length === 0) return null;

		const userInfo = await personaService.getActiveUserInfo(userId);

		const recent = (await this.getMessages(sessionId)).slice(-10);
		const chatHistory = recent
			.map((m) => {
				const name = m.role === 'user' ? userInfo.name : (m.role === 'assistant' ? (m.senderName || 'Character') : 'Narrator');
				return `${name}: ${m.content}`;
			})
			.join('\n\n');

		let previousState: any = null;
		if (session.worldInfo) {
			try {
				const parsed = JSON.parse(session.worldInfo);
				previousState = parsed.worldState || parsed;
			} catch { /* ignore */ }
		}

		const characterInfos = activeCharacters.map((c) => {
			let description = c.description || '';
			if (!description) {
				try {
					const cardData = JSON.parse(c.cardData);
					description = cardData.data?.description || cardData.description || '';
				} catch { /* ignore */ }
			}
			return { name: c.name, description };
		});

		const worldState = await clothesGenerationService.generateWorldState({
			characters: characterInfos,
			scenario: '',
			userName: userInfo.name,
			chatHistory,
			previousState
		});

		await db
			.update(sandboxSessions)
			.set({ worldInfo: JSON.stringify({ worldState }) })
			.where(eq(sandboxSessions.id, sessionId));

		return worldState;
	}
}

/**
 * Build a compact human-readable summary of a session's world state suitable
 * for feeding into a GM prompt. Returns "(none)" when the state is empty.
 */
export function formatWorldStateSummary(worldInfoRaw: string | null | undefined): string {
	if (!worldInfoRaw) return '(none)';
	try {
		const parsed = JSON.parse(worldInfoRaw);
		const state = parsed.worldState || parsed;
		if (!state || typeof state !== 'object' || Object.keys(state).length === 0) return '(none)';

		const lines: string[] = [];
		for (const [entity, entityState] of Object.entries<any>(state)) {
			const attrs = Array.isArray(entityState?.attributes) ? entityState.attributes : [];
			if (attrs.length === 0) continue;
			lines.push(`${entity}:`);
			for (const attr of attrs) {
				if (attr.type === 'list' && Array.isArray(attr.value)) {
					const items = attr.value.map((v: any) => v?.name).filter(Boolean).join(', ');
					lines.push(`  ${attr.name}: ${items || '(empty)'}`);
				} else if (typeof attr.value === 'string') {
					lines.push(`  ${attr.name}: ${attr.value}`);
				}
			}
		}
		return lines.length > 0 ? lines.join('\n') : '(none)';
	} catch {
		return '(none)';
	}
}

export const sandboxService = new SandboxService();
