import { db } from '../db';
import { conversations } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface ClothingItem {
	name: string;
	description: string;
}

export interface WorldInfo {
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
	 * Update clothes in world info
	 */
	async updateClothes(
		conversationId: number,
		clothes: { character: ClothingItem[]; user: ClothingItem[] }
	): Promise<void> {
		const existing = await this.getWorldInfo(conversationId);
		const updated: WorldInfo = {
			...existing,
			clothes
		};
		await this.saveWorldInfo(conversationId, updated);
	}

	/**
	 * Get clothes from world info
	 */
	async getClothes(conversationId: number): Promise<{ character: ClothingItem[]; user: ClothingItem[] } | null> {
		const worldInfo = await this.getWorldInfo(conversationId);
		return worldInfo?.clothes || null;
	}

	/**
	 * Format world info as text for prompt injection (both character and user)
	 */
	formatWorldInfoForPrompt(worldInfo: WorldInfo | null, characterName?: string, userName?: string): string {
		if (!worldInfo) return '';

		const charLabel = characterName || 'Character';
		const userLabel = userName || 'User';
		const parts: string[] = [];

		if (worldInfo.clothes) {
			const clothesParts: string[] = [];

			if (worldInfo.clothes.character.length > 0) {
				const charClothes = worldInfo.clothes.character
					.map(item => `  ${item.name}: ${item.description}`)
					.join('\n');
				clothesParts.push(`${charLabel}'s clothing:\n${charClothes}`);
			}

			if (worldInfo.clothes.user.length > 0) {
				const userClothes = worldInfo.clothes.user
					.map(item => `  ${item.name}: ${item.description}`)
					.join('\n');
				clothesParts.push(`${userLabel}'s clothing:\n${userClothes}`);
			}

			if (clothesParts.length > 0) {
				parts.push(clothesParts.join('\n\n'));
			}
		}

		return parts.join('\n\n');
	}

	/**
	 * Format only character clothes for prompt injection
	 */
	formatCharacterClothesForPrompt(worldInfo: WorldInfo | null, characterName?: string): string {
		if (!worldInfo?.clothes?.character?.length) return '';

		const charLabel = characterName || 'Character';
		const charClothes = worldInfo.clothes.character
			.map(item => `  ${item.name}: ${item.description}`)
			.join('\n');
		return `${charLabel}'s clothing:\n${charClothes}`;
	}

	/**
	 * Format only user clothes for prompt injection
	 */
	formatUserClothesForPrompt(worldInfo: WorldInfo | null, userName?: string): string {
		if (!worldInfo?.clothes?.user?.length) return '';

		const userLabel = userName || 'User';
		const userClothes = worldInfo.clothes.user
			.map(item => `  ${item.name}: ${item.description}`)
			.join('\n');
		return `${userLabel}'s clothing:\n${userClothes}`;
	}
}

export const worldInfoService = new WorldInfoService();
