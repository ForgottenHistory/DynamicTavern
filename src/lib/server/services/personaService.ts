import { db } from '../db';
import { users, userPersonas } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { UserPersona, NewUserPersona } from '../db/schema';
import sharp from 'sharp';

/**
 * Generate a thumbnail from base64 image data
 */
async function generateThumbnail(base64Data: string): Promise<string | null> {
	try {
		// Extract the actual base64 content (remove data:image/...;base64, prefix)
		const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
		if (!matches) return null;

		const imageBuffer = Buffer.from(matches[2], 'base64');

		// Generate thumbnail (128x170 to match character thumbnails)
		const thumbnailBuffer = await sharp(imageBuffer)
			.resize(128, 170, { fit: 'cover' })
			.png({ quality: 80 })
			.toBuffer();

		return `data:image/png;base64,${thumbnailBuffer.toString('base64')}`;
	} catch (error) {
		console.warn('Failed to generate avatar thumbnail:', error);
		return null;
	}
}

class PersonaService {
	/**
	 * Get all personas for a user
	 */
	async getUserPersonas(userId: number): Promise<UserPersona[]> {
		return await db
			.select()
			.from(userPersonas)
			.where(eq(userPersonas.userId, userId))
			.orderBy(userPersonas.createdAt);
	}

	/**
	 * Get a specific persona by ID
	 */
	async getPersonaById(personaId: number, userId: number): Promise<UserPersona | null> {
		const [persona] = await db
			.select()
			.from(userPersonas)
			.where(and(eq(userPersonas.id, personaId), eq(userPersonas.userId, userId)))
			.limit(1);

		return persona || null;
	}

	/**
	 * Get the active persona for a user (returns null if using default profile)
	 */
	async getActivePersona(userId: number): Promise<UserPersona | null> {
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		if (!user || !user.activePersonaId) {
			return null;
		}

		return await this.getPersonaById(user.activePersonaId, userId);
	}

	/**
	 * Get the display name and description to use for the user
	 * Returns active persona info if set, otherwise user profile info
	 * avatarData returns the thumbnail if available, falling back to full image
	 */
	async getActiveUserInfo(userId: number): Promise<{ name: string; description: string | null; avatarData: string | null }> {
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		if (!user) {
			return { name: 'User', description: null, avatarData: null };
		}

		if (user.activePersonaId) {
			const persona = await this.getPersonaById(user.activePersonaId, userId);
			if (persona) {
				return {
					name: persona.name,
					description: persona.description,
					avatarData: persona.avatarThumbnail || persona.avatarData
				};
			}
		}

		return {
			name: user.displayName,
			description: user.bio,
			avatarData: user.avatarThumbnail || user.avatarData
		};
	}

	/**
	 * Create a new persona
	 */
	async createPersona(
		userId: number,
		data: { name: string; description?: string; avatarData?: string }
	): Promise<UserPersona> {
		let avatarThumbnail: string | null = null;
		if (data.avatarData) {
			avatarThumbnail = await generateThumbnail(data.avatarData);
		}

		const [persona] = await db
			.insert(userPersonas)
			.values({
				userId,
				name: data.name,
				description: data.description || null,
				avatarData: data.avatarData || null,
				avatarThumbnail
			})
			.returning();

		return persona;
	}

	/**
	 * Update an existing persona
	 */
	async updatePersona(
		personaId: number,
		userId: number,
		data: { name?: string; description?: string; avatarData?: string }
	): Promise<UserPersona | null> {
		const updateData: any = { ...data };

		// Generate thumbnail if avatar is being updated
		if (data.avatarData) {
			const thumbnail = await generateThumbnail(data.avatarData);
			if (thumbnail) {
				updateData.avatarThumbnail = thumbnail;
			}
		} else if (data.avatarData === null) {
			// If avatar is being cleared, clear thumbnail too
			updateData.avatarThumbnail = null;
		}

		const [updated] = await db
			.update(userPersonas)
			.set(updateData)
			.where(and(eq(userPersonas.id, personaId), eq(userPersonas.userId, userId)))
			.returning();

		return updated || null;
	}

	/**
	 * Delete a persona
	 */
	async deletePersona(personaId: number, userId: number): Promise<boolean> {
		// First check if this is the active persona
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		// If deleting the active persona, clear the active persona
		if (user?.activePersonaId === personaId) {
			await db
				.update(users)
				.set({ activePersonaId: null })
				.where(eq(users.id, userId));
		}

		const result = await db
			.delete(userPersonas)
			.where(and(eq(userPersonas.id, personaId), eq(userPersonas.userId, userId)));

		return result.changes > 0;
	}

	/**
	 * Set the active persona for a user (null to use default profile)
	 */
	async setActivePersona(userId: number, personaId: number | null): Promise<boolean> {
		// Verify persona belongs to user if setting one
		if (personaId !== null) {
			const persona = await this.getPersonaById(personaId, userId);
			if (!persona) {
				return false;
			}
		}

		await db
			.update(users)
			.set({ activePersonaId: personaId })
			.where(eq(users.id, userId));

		return true;
	}
}

export const personaService = new PersonaService();
