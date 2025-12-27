import { db } from '../db';
import { conversations } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface ClothingItem {
	name: string;
	description: string;
}

export interface CharacterState {
	clothes: ClothingItem[];
	mood: string;
	position: string;
}

export interface UserState {
	clothes: ClothingItem[];
	position: string;
}

export interface WorldStateData {
	character: CharacterState;
	user: UserState;
}

export interface WorldInfo {
	worldState?: WorldStateData;
	// Legacy: keep for backwards compatibility during migration
	clothes?: {
		character: ClothingItem[];
		user: ClothingItem[];
	};
}

class WorldInfoService {
	/**
	 * Get world info for a conversation
	 */
	async getWorldInfo(conversationId: number): Promise<WorldInfo | null> {
		const conversation = await db.query.conversations.findFirst({
			where: eq(conversations.id, conversationId)
		});

		if (!conversation?.worldInfo) {
			return null;
		}

		try {
			return JSON.parse(conversation.worldInfo);
		} catch {
			return null;
		}
	}

	/**
	 * Save world info for a conversation
	 */
	async saveWorldInfo(conversationId: number, worldInfo: WorldInfo): Promise<void> {
		await db
			.update(conversations)
			.set({ worldInfo: JSON.stringify(worldInfo) })
			.where(eq(conversations.id, conversationId));
	}

	/**
	 * Update world state (clothes, mood, position)
	 */
	async updateWorldState(conversationId: number, worldState: WorldStateData): Promise<void> {
		const existing = await this.getWorldInfo(conversationId);
		const updated: WorldInfo = {
			...existing,
			worldState
		};
		await this.saveWorldInfo(conversationId, updated);
	}

	/**
	 * Backwards compatible: Update clothes (accepts new WorldStateData)
	 */
	async updateClothes(conversationId: number, worldState: WorldStateData): Promise<void> {
		return this.updateWorldState(conversationId, worldState);
	}

	/**
	 * Get world state (clothes, mood, position)
	 */
	async getWorldState(conversationId: number): Promise<WorldStateData | null> {
		const worldInfo = await this.getWorldInfo(conversationId);

		// Return new format if available
		if (worldInfo?.worldState) {
			return worldInfo.worldState;
		}

		// Migrate legacy format
		if (worldInfo?.clothes) {
			return {
				character: {
					clothes: worldInfo.clothes.character || [],
					mood: '',
					position: ''
				},
				user: {
					clothes: worldInfo.clothes.user || [],
					position: ''
				}
			};
		}

		return null;
	}

	/**
	 * Backwards compatible: Get clothes
	 */
	async getClothes(conversationId: number): Promise<WorldStateData | null> {
		return this.getWorldState(conversationId);
	}

	/**
	 * Format world info as text for prompt injection (both character and user)
	 */
	formatWorldInfoForPrompt(worldInfo: WorldInfo | null, characterName?: string, userName?: string): string {
		if (!worldInfo) return '';

		const charLabel = characterName || 'Character';
		const userLabel = userName || 'User';
		const parts: string[] = [];

		const worldState = worldInfo.worldState;
		if (worldState) {
			// Character section
			const charParts: string[] = [];
			if (worldState.character.mood) {
				charParts.push(`Mood: ${worldState.character.mood}`);
			}
			if (worldState.character.position) {
				charParts.push(`Position: ${worldState.character.position}`);
			}
			if (worldState.character.clothes.length > 0) {
				const clothes = worldState.character.clothes
					.map(item => `  ${item.name}: ${item.description}`)
					.join('\n');
				charParts.push(`Clothing:\n${clothes}`);
			}
			if (charParts.length > 0) {
				parts.push(`${charLabel}:\n${charParts.join('\n')}`);
			}

			// User section
			const userParts: string[] = [];
			if (worldState.user.position) {
				userParts.push(`Position: ${worldState.user.position}`);
			}
			if (worldState.user.clothes.length > 0) {
				const clothes = worldState.user.clothes
					.map(item => `  ${item.name}: ${item.description}`)
					.join('\n');
				userParts.push(`Clothing:\n${clothes}`);
			}
			if (userParts.length > 0) {
				parts.push(`${userLabel}:\n${userParts.join('\n')}`);
			}
		}

		return parts.join('\n\n');
	}

	/**
	 * Format only character state for prompt injection
	 */
	formatCharacterStateForPrompt(worldInfo: WorldInfo | null, characterName?: string): string {
		const worldState = worldInfo?.worldState;
		if (!worldState?.character) return '';

		const charLabel = characterName || 'Character';
		const parts: string[] = [];

		if (worldState.character.mood) {
			parts.push(`Mood: ${worldState.character.mood}`);
		}
		if (worldState.character.position) {
			parts.push(`Position: ${worldState.character.position}`);
		}
		if (worldState.character.clothes.length > 0) {
			const clothes = worldState.character.clothes
				.map(item => `  ${item.name}: ${item.description}`)
				.join('\n');
			parts.push(`Clothing:\n${clothes}`);
		}

		return parts.length > 0 ? `${charLabel}:\n${parts.join('\n')}` : '';
	}

	/**
	 * Format only character clothes for prompt injection (backwards compat)
	 */
	formatCharacterClothesForPrompt(worldInfo: WorldInfo | null, characterName?: string): string {
		const worldState = worldInfo?.worldState;
		if (!worldState?.character?.clothes?.length) return '';

		const charLabel = characterName || 'Character';
		const charClothes = worldState.character.clothes
			.map(item => `  ${item.name}: ${item.description}`)
			.join('\n');
		return `${charLabel}'s clothing:\n${charClothes}`;
	}

	/**
	 * Format only user state for prompt injection
	 */
	formatUserStateForPrompt(worldInfo: WorldInfo | null, userName?: string): string {
		const worldState = worldInfo?.worldState;
		if (!worldState?.user) return '';

		const userLabel = userName || 'User';
		const parts: string[] = [];

		if (worldState.user.position) {
			parts.push(`Position: ${worldState.user.position}`);
		}
		if (worldState.user.clothes.length > 0) {
			const clothes = worldState.user.clothes
				.map(item => `  ${item.name}: ${item.description}`)
				.join('\n');
			parts.push(`Clothing:\n${clothes}`);
		}

		return parts.length > 0 ? `${userLabel}:\n${parts.join('\n')}` : '';
	}

	/**
	 * Format only user clothes for prompt injection (backwards compat)
	 */
	formatUserClothesForPrompt(worldInfo: WorldInfo | null, userName?: string): string {
		const worldState = worldInfo?.worldState;
		if (!worldState?.user?.clothes?.length) return '';

		const userLabel = userName || 'User';
		const userClothes = worldState.user.clothes
			.map(item => `  ${item.name}: ${item.description}`)
			.join('\n');
		return `${userLabel}'s clothing:\n${userClothes}`;
	}
}

export const worldInfoService = new WorldInfoService();
