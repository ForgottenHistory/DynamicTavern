import { db } from '../db';
import { sandboxParticipants, characters } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { Character, SandboxParticipant } from '../db/schema';

class SandboxParticipantService {
	/**
	 * Get all active characters in a sandbox session
	 */
	async getActiveCharacters(sessionId: number): Promise<Character[]> {
		const participants = await db
			.select({
				character: characters
			})
			.from(sandboxParticipants)
			.innerJoin(characters, eq(sandboxParticipants.characterId, characters.id))
			.where(
				and(
					eq(sandboxParticipants.sandboxSessionId, sessionId),
					eq(sandboxParticipants.isActive, true)
				)
			)
			.orderBy(sandboxParticipants.joinedAt);

		return participants.map((p) => p.character);
	}

	/**
	 * Add a character to a sandbox session (or reactivate if previously removed)
	 */
	async addCharacterToScene(sessionId: number, characterId: number): Promise<SandboxParticipant> {
		// Check if character already has a record in this session
		const [existing] = await db
			.select()
			.from(sandboxParticipants)
			.where(
				and(
					eq(sandboxParticipants.sandboxSessionId, sessionId),
					eq(sandboxParticipants.characterId, characterId)
				)
			)
			.limit(1);

		if (existing) {
			// Reactivate if inactive
			if (!existing.isActive) {
				const [updated] = await db
					.update(sandboxParticipants)
					.set({ isActive: true, leftAt: null })
					.where(eq(sandboxParticipants.id, existing.id))
					.returning();
				return updated;
			}
			return existing;
		}

		// Add new participant
		const [participant] = await db
			.insert(sandboxParticipants)
			.values({
				sandboxSessionId: sessionId,
				characterId,
				isActive: true
			})
			.returning();

		return participant;
	}

	/**
	 * Remove a character from a sandbox session (marks as inactive)
	 */
	async removeCharacterFromScene(sessionId: number, characterId: number): Promise<boolean> {
		const result = await db
			.update(sandboxParticipants)
			.set({ isActive: false, leftAt: new Date() })
			.where(
				and(
					eq(sandboxParticipants.sandboxSessionId, sessionId),
					eq(sandboxParticipants.characterId, characterId),
					eq(sandboxParticipants.isActive, true)
				)
			);

		return result.changes > 0;
	}

	/**
	 * Deactivate all participants in a session (used on location move)
	 */
	async deactivateAll(sessionId: number): Promise<void> {
		await db
			.update(sandboxParticipants)
			.set({ isActive: false, leftAt: new Date() })
			.where(
				and(
					eq(sandboxParticipants.sandboxSessionId, sessionId),
					eq(sandboxParticipants.isActive, true)
				)
			);
	}

	/**
	 * Check if a character is currently active in a session
	 */
	async isCharacterInScene(sessionId: number, characterId: number): Promise<boolean> {
		const [participant] = await db
			.select()
			.from(sandboxParticipants)
			.where(
				and(
					eq(sandboxParticipants.sandboxSessionId, sessionId),
					eq(sandboxParticipants.characterId, characterId),
					eq(sandboxParticipants.isActive, true)
				)
			)
			.limit(1);

		return !!participant;
	}
}

export const sandboxParticipantService = new SandboxParticipantService();
