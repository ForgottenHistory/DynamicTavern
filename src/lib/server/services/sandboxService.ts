import { db } from '$lib/server/db';
import { sandboxSessions, messages, characters, type Character, type Message } from '$lib/server/db/schema';
import { eq, and, gte, asc } from 'drizzle-orm';
import { worldService } from './worldService';
import type { World } from '$lib/types/sandbox';

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
		character: Character | null;
	} | null> {
		const session = await this.getSession(sessionId, userId);
		if (!session) return null;

		const world = await worldService.get(session.worldFile);
		if (!world) return null;

		// Validate the move is allowed
		if (!worldService.canMoveTo(world, session.currentLocationId, locationId)) {
			return null;
		}

		// Spawn a character at the new location
		const location = worldService.getLocation(world, locationId);
		const character = await this.spawnCharacter(
			userId,
			location?.characterFilters !== null,
			world.spawnChance
		);

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

		return { session: updated, character };
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
	 * Update the current character for a session
	 */
	async setCurrentCharacter(
		sessionId: number,
		userId: number,
		characterId: number | null
	): Promise<boolean> {
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
	 * Get the current character for a session
	 */
	async getCurrentCharacter(session: typeof sandboxSessions.$inferSelect): Promise<Character | null> {
		if (!session.currentCharacterId) return null;

		const [character] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, session.currentCharacterId))
			.limit(1);

		return character || null;
	}
}

export const sandboxService = new SandboxService();
