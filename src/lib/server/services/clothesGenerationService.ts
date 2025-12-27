import { decisionEngineSettingsService } from './decisionEngineSettingsService';
import { callLlm } from './llmCallService';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_DIR = 'data/prompts';

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

// Backwards compatibility alias
export type ClothesData = WorldStateData;

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
 * Parse world state from LLM response with sections
 * Format:
 * CharacterName:
 * mood: emotional state
 * position: physical position
 * clothes:
 *   item: description
 *
 * UserName:
 * position: physical position
 * clothes:
 *   item: description
 */
function parseWorldState(content: string, characterName: string, userName: string): WorldStateData {
	const result: WorldStateData = {
		character: { clothes: [], mood: '', position: '' },
		user: { clothes: [], position: '' }
	};
	const lines = content.split('\n');

	let currentSection: 'character' | 'user' | null = null;
	let inClothesBlock = false;
	const charNameLower = characterName.toLowerCase();
	const userNameLower = userName.toLowerCase();

	for (const line of lines) {
		const trimmedLine = line.trim();
		if (!trimmedLine) continue;

		const colonIndex = trimmedLine.indexOf(':');
		if (colonIndex > 0) {
			const beforeColon = trimmedLine.substring(0, colonIndex).trim().toLowerCase();
			const afterColon = trimmedLine.substring(colonIndex + 1).trim();

			// Check if it's a section header (name followed by colon with nothing after)
			if (!afterColon || afterColon === '') {
				if (beforeColon === charNameLower || beforeColon.includes(charNameLower)) {
					currentSection = 'character';
					inClothesBlock = false;
					continue;
				} else if (beforeColon === userNameLower || beforeColon.includes(userNameLower)) {
					currentSection = 'user';
					inClothesBlock = false;
					continue;
				} else if (beforeColon === 'clothes' || beforeColon === 'clothing') {
					inClothesBlock = true;
					continue;
				}
			}

			if (!currentSection) continue;

			// Parse mood (character only)
			if (beforeColon === 'mood' && currentSection === 'character' && afterColon) {
				result.character.mood = afterColon;
				inClothesBlock = false;
				continue;
			}

			// Parse position
			if (beforeColon === 'position' && afterColon) {
				result[currentSection].position = afterColon;
				inClothesBlock = false;
				continue;
			}

			// Check for clothes header
			if (beforeColon === 'clothes' || beforeColon === 'clothing') {
				inClothesBlock = true;
				continue;
			}

			// If we're in a clothes block or it looks like a clothing item, add it
			if (afterColon && (inClothesBlock || (!['mood', 'position'].includes(beforeColon)))) {
				result[currentSection].clothes.push({ name: beforeColon, description: afterColon });
			}
		}
	}

	return result;
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
			const worldState = parseWorldState(result.content, characterName, userName);
			console.log(`🌍 Generated world state:`, worldState);

			// Return parsed or default if empty
			if (worldState.character.clothes.length > 0 || worldState.user.clothes.length > 0 ||
				worldState.character.mood || worldState.character.position || worldState.user.position) {
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
				mood: 'neutral',
				position: 'standing nearby',
				clothes: [
					{ name: 'top', description: 'casual shirt' },
					{ name: 'bottom', description: 'comfortable pants' },
					{ name: 'shoes', description: 'everyday footwear' }
				]
			},
			user: {
				position: 'standing nearby',
				clothes: [
					{ name: 'top', description: 'casual shirt' },
					{ name: 'bottom', description: 'comfortable pants' },
					{ name: 'shoes', description: 'everyday footwear' }
				]
			}
		};
	}
}

export const worldStateGenerationService = new WorldStateGenerationService();
// Backwards compatibility
export const clothesGenerationService = worldStateGenerationService;
