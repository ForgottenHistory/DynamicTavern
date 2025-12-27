import { db } from '../db';
import { sceneParticipants, characters, conversations } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { Character, SceneParticipant } from '../db/schema';

export interface SceneCharacter extends Character {
	joinedAt: Date;
	isActive: boolean;
}

class SceneService {
	/**
	 * Get all active characters in a scene/conversation
	 */
	async getActiveCharacters(conversationId: number): Promise<SceneCharacter[]> {
		const participants = await db
			.select({
				participant: sceneParticipants,
				character: characters
			})
			.from(sceneParticipants)
			.innerJoin(characters, eq(sceneParticipants.characterId, characters.id))
			.where(
				and(
					eq(sceneParticipants.conversationId, conversationId),
					eq(sceneParticipants.isActive, true)
				)
			)
			.orderBy(sceneParticipants.joinedAt);

		return participants.map((p) => ({
			...p.character,
			joinedAt: p.participant.joinedAt,
			isActive: p.participant.isActive
		}));
	}

	/**
	 * Get all characters (including inactive) in a scene
	 */
	async getAllCharacters(conversationId: number): Promise<SceneCharacter[]> {
		const participants = await db
			.select({
				participant: sceneParticipants,
				character: characters
			})
			.from(sceneParticipants)
			.innerJoin(characters, eq(sceneParticipants.characterId, characters.id))
			.where(eq(sceneParticipants.conversationId, conversationId))
			.orderBy(sceneParticipants.joinedAt);

		return participants.map((p) => ({
			...p.character,
			joinedAt: p.participant.joinedAt,
			isActive: p.participant.isActive
		}));
	}

	/**
	 * Add a character to a scene
	 */
	async addCharacterToScene(
		conversationId: number,
		characterId: number
	): Promise<SceneParticipant> {
		// Check if character is already in scene
		const [existing] = await db
			.select()
			.from(sceneParticipants)
			.where(
				and(
					eq(sceneParticipants.conversationId, conversationId),
					eq(sceneParticipants.characterId, characterId)
				)
			)
			.limit(1);

		if (existing) {
			// Reactivate if was inactive
			if (!existing.isActive) {
				const [updated] = await db
					.update(sceneParticipants)
					.set({ isActive: true, leftAt: null })
					.where(eq(sceneParticipants.id, existing.id))
					.returning();
				return updated;
			}
			return existing;
		}

		// Add new participant
		const [participant] = await db
			.insert(sceneParticipants)
			.values({
				conversationId,
				characterId,
				isActive: true
			})
			.returning();

		return participant;
	}

	/**
	 * Remove a character from a scene (marks as inactive)
	 */
	async removeCharacterFromScene(
		conversationId: number,
		characterId: number
	): Promise<boolean> {
		const result = await db
			.update(sceneParticipants)
			.set({ isActive: false, leftAt: new Date() })
			.where(
				and(
					eq(sceneParticipants.conversationId, conversationId),
					eq(sceneParticipants.characterId, characterId),
					eq(sceneParticipants.isActive, true)
				)
			);

		return result.changes > 0;
	}

	/**
	 * Check if a character is currently in a scene
	 */
	async isCharacterInScene(conversationId: number, characterId: number): Promise<boolean> {
		const [participant] = await db
			.select()
			.from(sceneParticipants)
			.where(
				and(
					eq(sceneParticipants.conversationId, conversationId),
					eq(sceneParticipants.characterId, characterId),
					eq(sceneParticipants.isActive, true)
				)
			)
			.limit(1);

		return !!participant;
	}

	/**
	 * Get the primary character for a scene (first active character or primaryCharacterId)
	 */
	async getPrimaryCharacter(conversationId: number): Promise<Character | null> {
		// First check if conversation has a primaryCharacterId set
		const [conversation] = await db
			.select()
			.from(conversations)
			.where(eq(conversations.id, conversationId))
			.limit(1);

		if (conversation?.primaryCharacterId) {
			const [character] = await db
				.select()
				.from(characters)
				.where(eq(characters.id, conversation.primaryCharacterId))
				.limit(1);

			if (character) return character;
		}

		// Fall back to first active character
		const activeChars = await this.getActiveCharacters(conversationId);
		return activeChars[0] || null;
	}

	/**
	 * Initialize scene participants for a new conversation (migrates from legacy characterId)
	 */
	async initializeFromLegacy(conversationId: number, characterId: number): Promise<void> {
		// Check if already has participants
		const existing = await this.getActiveCharacters(conversationId);
		if (existing.length > 0) return;

		// Add the legacy character as first participant
		await this.addCharacterToScene(conversationId, characterId);

		// Set as primary character
		await db
			.update(conversations)
			.set({ primaryCharacterId: characterId })
			.where(eq(conversations.id, conversationId));
	}
}

export const sceneService = new SceneService();
