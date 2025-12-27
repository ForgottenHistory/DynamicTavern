import { db } from '../db';
import { conversations } from '../db/schema';
import { eq } from 'drizzle-orm';

// Generic item for list-type attributes (e.g., clothes, inventory)
export interface ListItem {
	name: string;
	description: string;
}

// A single attribute value - can be text or a list of items
export interface WorldAttribute {
	name: string;
	type: 'text' | 'list';
	value: string | ListItem[];
}

// Entity state is just a collection of attributes
export interface EntityState {
	attributes: WorldAttribute[];
}

// The world state contains named entities (character, user, or custom)
export interface WorldStateData {
	[entity: string]: EntityState;
}

export interface WorldInfo {
	worldState?: WorldStateData;
}

// Legacy types for backwards compatibility
export interface ClothingItem extends ListItem {}

export interface CharacterState {
	clothes: ClothingItem[];
	mood: string;
	position: string;
}

export interface UserState {
	clothes: ClothingItem[];
	position: string;
}

// Helper to get attribute value from entity
function getAttributeValue(entity: EntityState | undefined, name: string): WorldAttribute | undefined {
	return entity?.attributes.find(a => a.name.toLowerCase() === name.toLowerCase());
}

// Helper to get text attribute
function getTextAttribute(entity: EntityState | undefined, name: string): string {
	const attr = getAttributeValue(entity, name);
	if (attr?.type === 'text' && typeof attr.value === 'string') {
		return attr.value;
	}
	return '';
}

// Helper to get list attribute
function getListAttribute(entity: EntityState | undefined, name: string): ListItem[] {
	const attr = getAttributeValue(entity, name);
	if (attr?.type === 'list' && Array.isArray(attr.value)) {
		return attr.value;
	}
	return [];
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
			const parsed = JSON.parse(conversation.worldInfo);
			// Migrate old format to new if needed
			return this.migrateWorldInfo(parsed);
		} catch {
			return null;
		}
	}

	/**
	 * Migrate old world info format to new generic format
	 */
	private migrateWorldInfo(data: any): WorldInfo {
		// Already in new format
		if (data.worldState && typeof data.worldState === 'object') {
			const firstEntity = Object.values(data.worldState)[0] as any;
			if (firstEntity?.attributes && Array.isArray(firstEntity.attributes)) {
				return data;
			}
			// Old format with character/user having direct properties
			return { worldState: this.migrateOldWorldState(data.worldState) };
		}
		// Legacy clothes-only format
		if (data.clothes) {
			return {
				worldState: {
					character: {
						attributes: [
							{ name: 'clothes', type: 'list', value: data.clothes.character || [] }
						]
					},
					user: {
						attributes: [
							{ name: 'clothes', type: 'list', value: data.clothes.user || [] }
						]
					}
				}
			};
		}
		return data;
	}

	/**
	 * Migrate old world state format (mood, position, clothes as direct properties)
	 */
	private migrateOldWorldState(oldState: any): WorldStateData {
		const result: WorldStateData = {};

		for (const [entityName, entityData] of Object.entries(oldState)) {
			const entity = entityData as any;
			const attributes: WorldAttribute[] = [];

			// Convert known properties to attributes
			if (entity.mood) {
				attributes.push({ name: 'mood', type: 'text', value: entity.mood });
			}
			if (entity.position) {
				attributes.push({ name: 'position', type: 'text', value: entity.position });
			}
			if (entity.clothes && Array.isArray(entity.clothes)) {
				attributes.push({ name: 'clothes', type: 'list', value: entity.clothes });
			}

			// Add any other properties as text attributes
			for (const [key, value] of Object.entries(entity)) {
				if (!['mood', 'position', 'clothes'].includes(key)) {
					if (Array.isArray(value)) {
						attributes.push({ name: key, type: 'list', value: value as ListItem[] });
					} else if (typeof value === 'string') {
						attributes.push({ name: key, type: 'text', value });
					}
				}
			}

			result[entityName] = { attributes };
		}

		return result;
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
	 * Update world state
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
	 * Get world state
	 */
	async getWorldState(conversationId: number): Promise<WorldStateData | null> {
		const worldInfo = await this.getWorldInfo(conversationId);
		return worldInfo?.worldState || null;
	}

	/**
	 * Backwards compatible: Get clothes
	 */
	async getClothes(conversationId: number): Promise<WorldStateData | null> {
		return this.getWorldState(conversationId);
	}

	/**
	 * Helper: Get a specific attribute from an entity
	 */
	getAttribute(worldState: WorldStateData | null, entityName: string, attrName: string): WorldAttribute | undefined {
		return getAttributeValue(worldState?.[entityName], attrName);
	}

	/**
	 * Helper: Get text attribute value
	 */
	getTextAttribute(worldState: WorldStateData | null, entityName: string, attrName: string): string {
		return getTextAttribute(worldState?.[entityName], attrName);
	}

	/**
	 * Helper: Get list attribute value
	 */
	getListAttribute(worldState: WorldStateData | null, entityName: string, attrName: string): ListItem[] {
		return getListAttribute(worldState?.[entityName], attrName);
	}

	/**
	 * Format a single attribute for prompt text
	 */
	private formatAttribute(attr: WorldAttribute): string {
		if (attr.type === 'text' && typeof attr.value === 'string') {
			return `${attr.name}: ${attr.value}`;
		}
		if (attr.type === 'list' && Array.isArray(attr.value) && attr.value.length > 0) {
			const items = attr.value
				.map(item => `  ${item.name}: ${item.description}`)
				.join('\n');
			return `${attr.name}:\n${items}`;
		}
		return '';
	}

	/**
	 * Format entity state for prompt injection
	 */
	formatEntityForPrompt(entity: EntityState | undefined, label: string): string {
		if (!entity?.attributes.length) return '';

		const parts = entity.attributes
			.map(attr => this.formatAttribute(attr))
			.filter(s => s);

		return parts.length > 0 ? `${label}:\n${parts.join('\n')}` : '';
	}

	/**
	 * Format world info as text for prompt injection (all entities)
	 */
	formatWorldInfoForPrompt(worldInfo: WorldInfo | null, characterName?: string, userName?: string): string {
		if (!worldInfo?.worldState) return '';

		const parts: string[] = [];
		const entityLabels: Record<string, string> = {
			character: characterName || 'Character',
			user: userName || 'User'
		};

		for (const [entityName, entity] of Object.entries(worldInfo.worldState)) {
			const label = entityLabels[entityName] || entityName;
			const formatted = this.formatEntityForPrompt(entity, label);
			if (formatted) parts.push(formatted);
		}

		return parts.join('\n\n');
	}

	/**
	 * Format only character state for prompt injection
	 */
	formatCharacterStateForPrompt(worldInfo: WorldInfo | null, characterName?: string): string {
		return this.formatEntityForPrompt(
			worldInfo?.worldState?.character,
			characterName || 'Character'
		);
	}

	/**
	 * Format only user state for prompt injection
	 */
	formatUserStateForPrompt(worldInfo: WorldInfo | null, userName?: string): string {
		return this.formatEntityForPrompt(
			worldInfo?.worldState?.user,
			userName || 'User'
		);
	}
}

export const worldInfoService = new WorldInfoService();
