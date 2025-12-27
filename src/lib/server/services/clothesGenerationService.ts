import { decisionEngineSettingsService } from './decisionEngineSettingsService';
import { callLlm } from './llmCallService';
import { type WorldStateData, type EntityState, type WorldAttribute, type ListItem } from './worldInfoService';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_DIR = 'data/prompts';
const CONFIG_DIR = 'data/config';

// Re-export types for backwards compatibility
export type { WorldStateData, EntityState, WorldAttribute, ListItem };
export type ClothesData = WorldStateData;

// Attribute configuration
interface AttributeConfig {
	name: string;
	type: 'text' | 'list';
	description: string;
}

interface WorldAttributesConfig {
	character: AttributeConfig[];
	user: AttributeConfig[];
	[entity: string]: AttributeConfig[];
}

/**
 * Load attribute configuration from file
 */
async function loadAttributeConfig(): Promise<WorldAttributesConfig> {
	try {
		const content = await fs.readFile(path.join(CONFIG_DIR, 'world_attributes.json'), 'utf-8');
		return JSON.parse(content);
	} catch {
		// Default configuration
		return {
			character: [
				{ name: 'mood', type: 'text', description: 'Current emotional state' },
				{ name: 'position', type: 'text', description: 'Physical position/location' },
				{ name: 'clothes', type: 'list', description: 'Clothing items being worn' }
			],
			user: [
				{ name: 'position', type: 'text', description: 'Physical position/location' }
			]
		};
	}
}

/**
 * Replace template variables in prompts
 */
function replaceTemplateVariables(
	template: string,
	variables: { char: string; user: string; scenario: string; description: string; history: string }
): string {
	return template
		.replace(/\{\{char\}\}/g, variables.char)
		.replace(/\{\{user\}\}/g, variables.user)
		.replace(/\{\{scenario\}\}/g, variables.scenario)
		.replace(/\{\{description\}\}/g, variables.description)
		.replace(/\{\{history\}\}/g, variables.history);
}

/**
 * Parse world state from LLM response - generic parser
 * Handles any entity sections and any attributes
 */
function parseWorldState(content: string, entityNames: Record<string, string>): WorldStateData {
	const result: WorldStateData = {};
	const lines = content.split('\n');

	// Map lowercase names to entity keys
	const nameToEntity: Record<string, string> = {};
	for (const [key, name] of Object.entries(entityNames)) {
		nameToEntity[name.toLowerCase()] = key;
	}

	let currentEntity: string | null = null;
	let currentListAttr: string | null = null;
	const listItems: Record<string, Record<string, ListItem[]>> = {};

	for (const line of lines) {
		const trimmedLine = line.trim();
		if (!trimmedLine) continue;

		const colonIndex = trimmedLine.indexOf(':');
		if (colonIndex > 0) {
			const beforeColon = trimmedLine.substring(0, colonIndex).trim();
			const beforeColonLower = beforeColon.toLowerCase();
			const afterColon = trimmedLine.substring(colonIndex + 1).trim();

			// Check if it's an entity header (name followed by colon with nothing after)
			if (!afterColon || afterColon === '') {
				// Check if it matches any known entity name
				for (const [name, entityKey] of Object.entries(nameToEntity)) {
					if (beforeColonLower === name || beforeColonLower.includes(name)) {
						currentEntity = entityKey;
						currentListAttr = null;
						if (!result[entityKey]) {
							result[entityKey] = { attributes: [] };
						}
						break;
					}
				}
				// Could be a list attribute header (e.g., "clothes:")
				if (currentEntity && !nameToEntity[beforeColonLower]) {
					currentListAttr = beforeColonLower;
					if (!listItems[currentEntity]) listItems[currentEntity] = {};
					if (!listItems[currentEntity][currentListAttr]) {
						listItems[currentEntity][currentListAttr] = [];
					}
				}
				continue;
			}

			if (!currentEntity) continue;

			// If we're in a list block, add as list item
			if (currentListAttr) {
				if (!listItems[currentEntity]) listItems[currentEntity] = {};
				if (!listItems[currentEntity][currentListAttr]) {
					listItems[currentEntity][currentListAttr] = [];
				}
				listItems[currentEntity][currentListAttr].push({
					name: beforeColon,
					description: afterColon
				});
			} else {
				// Check if this could be a list header or a text attribute
				// Heuristic: if the value is short and looks like a header, it might be a list
				// Otherwise, treat as text
				if (afterColon.length < 50 && !afterColon.includes(',') && !afterColon.includes('.')) {
					// Could still be a text attribute with short value
					result[currentEntity].attributes.push({
						name: beforeColonLower,
						type: 'text',
						value: afterColon
					});
				} else {
					result[currentEntity].attributes.push({
						name: beforeColonLower,
						type: 'text',
						value: afterColon
					});
				}
			}
		} else if (currentEntity && currentListAttr && trimmedLine.startsWith('-')) {
			// Handle bullet point items in lists
			const itemText = trimmedLine.substring(1).trim();
			const itemColonIdx = itemText.indexOf(':');
			if (itemColonIdx > 0) {
				const itemName = itemText.substring(0, itemColonIdx).trim();
				const itemDesc = itemText.substring(itemColonIdx + 1).trim();
				if (!listItems[currentEntity]) listItems[currentEntity] = {};
				if (!listItems[currentEntity][currentListAttr]) {
					listItems[currentEntity][currentListAttr] = [];
				}
				listItems[currentEntity][currentListAttr].push({
					name: itemName,
					description: itemDesc
				});
			}
		}
	}

	// Convert list items to attributes
	for (const [entityKey, attrLists] of Object.entries(listItems)) {
		if (!result[entityKey]) result[entityKey] = { attributes: [] };
		for (const [attrName, items] of Object.entries(attrLists)) {
			if (items.length > 0) {
				// Remove any existing text attribute with same name
				result[entityKey].attributes = result[entityKey].attributes.filter(
					a => a.name !== attrName
				);
				result[entityKey].attributes.push({
					name: attrName,
					type: 'list',
					value: items
				});
			}
		}
	}

	return result;
}

/**
 * Check if world state has any meaningful data
 */
function hasContent(state: WorldStateData): boolean {
	for (const entity of Object.values(state)) {
		if (entity.attributes.some(attr => {
			if (attr.type === 'text' && typeof attr.value === 'string' && attr.value.trim()) return true;
			if (attr.type === 'list' && Array.isArray(attr.value) && attr.value.length > 0) return true;
			return false;
		})) {
			return true;
		}
	}
	return false;
}

class WorldStateGenerationService {
	private defaultPrompt = `Generate the current state for {{char}}.

Character: {{char}}
Description: {{description}}
Scenario: {{scenario}}

Recent conversation:
{{history}}

Output format:
{{char}}:
mood: [current emotional state]
position: [physical position/location]
clothes:
  [item]: [description]

Guidelines:
- Mood: Brief emotional state based on recent events (cheerful, anxious, relaxed, etc.)
- Position: Physical location and posture/stance
- Clothes: 3-5 items, be specific with colors and styles
- Base the state on what's happening in the conversation`;

	/**
	 * Load world state prompt from file
	 */
	async loadPrompt(): Promise<string> {
		try {
			const content = await fs.readFile(path.join(PROMPTS_DIR, 'world_generation.txt'), 'utf-8');
			return content.trim();
		} catch (error) {
			console.log('No world_generation.txt found, using default prompt');
			return this.defaultPrompt;
		}
	}

	/**
	 * Generate world state for character and user
	 */
	async generateWorldState({
		characterName,
		characterDescription,
		scenario,
		userName,
		chatHistory
	}: {
		characterName: string;
		characterDescription: string;
		scenario: string;
		userName: string;
		chatHistory?: string;
	}): Promise<WorldStateData> {
		try {
			console.log(`🌍 Generating world state for ${characterName} and ${userName}...`);

			const settings = decisionEngineSettingsService.getSettings();
			const promptTemplate = await this.loadPrompt();

			const prompt = replaceTemplateVariables(promptTemplate, {
				char: characterName,
				user: userName,
				scenario: scenario || 'A casual encounter',
				description: characterDescription || '',
				history: chatHistory || '(No conversation yet)'
			});

			const result = await callLlm({
				messages: [{ role: 'user', content: prompt }],
				settings,
				logType: 'world',
				logCharacterName: characterName
			});

			// Parse world state from response
			const worldState = parseWorldState(result.content, {
				character: characterName,
				user: userName
			});
			console.log(`🌍 Generated world state:`, JSON.stringify(worldState, null, 2));

			// Return parsed or default if empty
			if (hasContent(worldState)) {
				return worldState;
			}
			return this.getDefaultWorldState();
		} catch (error: any) {
			console.error('❌ Failed to generate world state:', error.message);
			return this.getDefaultWorldState();
		}
	}

	// Backwards compatibility
	async generateClothes(params: {
		characterName: string;
		characterDescription: string;
		scenario: string;
		userName: string;
		chatHistory?: string;
	}): Promise<WorldStateData> {
		return this.generateWorldState(params);
	}

	private getDefaultWorldState(): WorldStateData {
		return {
			character: {
				attributes: [
					{ name: 'mood', type: 'text', value: 'neutral' },
					{ name: 'position', type: 'text', value: 'standing nearby' },
					{
						name: 'clothes',
						type: 'list',
						value: [
							{ name: 'top', description: 'casual shirt' },
							{ name: 'bottom', description: 'comfortable pants' },
							{ name: 'shoes', description: 'everyday footwear' }
						]
					}
				]
			},
			user: {
				attributes: [
					{ name: 'position', type: 'text', value: 'standing nearby' }
				]
			}
		};
	}
}

export const worldStateGenerationService = new WorldStateGenerationService();
// Backwards compatibility
export const clothesGenerationService = worldStateGenerationService;
