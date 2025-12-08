import { decisionEngineSettingsService } from './decisionEngineSettingsService';
import { callLlm } from './llmCallService';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_DIR = 'data/prompts';

export interface ClothingItem {
	name: string;
	description: string;
}

export interface ClothesData {
	character: ClothingItem[];
	user: ClothingItem[];
}

/**
 * Replace template variables in prompts
 */
function replaceTemplateVariables(
	template: string,
	variables: { char: string; user: string; scenario: string; description: string }
): string {
	return template
		.replace(/\{\{char\}\}/g, variables.char)
		.replace(/\{\{user\}\}/g, variables.user)
		.replace(/\{\{scenario\}\}/g, variables.scenario)
		.replace(/\{\{description\}\}/g, variables.description);
}

/**
 * Parse clothing items from LLM response with sections
 * Format:
 * CharacterName:
 * item: description
 *
 * UserName:
 * item: description
 */
function parseClothingBySections(content: string, characterName: string, userName: string): ClothesData {
	const result: ClothesData = { character: [], user: [] };
	const lines = content.split('\n');

	let currentSection: 'character' | 'user' | null = null;
	const charNameLower = characterName.toLowerCase();
	const userNameLower = userName.toLowerCase();

	for (const line of lines) {
		const trimmedLine = line.trim();
		if (!trimmedLine) continue;

		// Check if this is a section header (ends with : and no other colons, or the text before first colon matches a name)
		const colonIndex = trimmedLine.indexOf(':');
		if (colonIndex > 0) {
			const beforeColon = trimmedLine.substring(0, colonIndex).trim().toLowerCase();
			const afterColon = trimmedLine.substring(colonIndex + 1).trim();

			// Check if it's a section header (name followed by colon with nothing or whitespace after)
			if (!afterColon || afterColon === '') {
				if (beforeColon === charNameLower || beforeColon.includes(charNameLower)) {
					currentSection = 'character';
					continue;
				} else if (beforeColon === userNameLower || beforeColon.includes(userNameLower)) {
					currentSection = 'user';
					continue;
				}
			}

			// It's a clothing item if we have a current section
			if (currentSection && afterColon) {
				result[currentSection].push({ name: beforeColon, description: afterColon });
			}
		}
	}

	return result;
}

class ClothesGenerationService {
	private defaultPrompt = `Generate a list of clothing items that {{char}} and {{user}} are currently wearing.

Character: {{char}}
Description: {{description}}
Scenario: {{scenario}}

Output format (section headers followed by items):
{{char}}:
[item]: [description]

{{user}}:
[item]: [description]

List 3-5 items per person. Be specific with colors and styles.`;

	/**
	 * Load clothes prompt from file
	 */
	async loadPrompt(): Promise<string> {
		try {
			const content = await fs.readFile(path.join(PROMPTS_DIR, 'clothes_generation.txt'), 'utf-8');
			return content.trim();
		} catch (error) {
			console.log('No clothes_generation.txt found, using default prompt');
			return this.defaultPrompt;
		}
	}

	/**
	 * Generate clothes descriptions for character and user
	 */
	async generateClothes({
		characterName,
		characterDescription,
		scenario,
		userName
	}: {
		characterName: string;
		characterDescription: string;
		scenario: string;
		userName: string;
	}): Promise<ClothesData> {
		try {
			console.log(`👔 Generating clothes for ${characterName} and ${userName}...`);

			const settings = decisionEngineSettingsService.getSettings();
			const promptTemplate = await this.loadPrompt();

			const prompt = replaceTemplateVariables(promptTemplate, {
				char: characterName,
				user: userName,
				scenario: scenario || 'A casual encounter',
				description: characterDescription || ''
			});

			const result = await callLlm({
				messages: [{ role: 'user', content: prompt }],
				settings,
				logType: 'clothes',
				logCharacterName: characterName
			});

			// Parse clothing items from response
			const clothes = parseClothingBySections(result.content, characterName, userName);
			console.log(`👔 Generated clothes:`, clothes);

			// Return parsed or default if both sections are empty
			if (clothes.character.length > 0 || clothes.user.length > 0) {
				return clothes;
			}
			return this.getDefaultClothes();
		} catch (error: any) {
			console.error('❌ Failed to generate clothes:', error.message);
			return this.getDefaultClothes();
		}
	}

	private getDefaultClothes(): ClothesData {
		return {
			character: [
				{ name: 'top', description: 'casual shirt' },
				{ name: 'bottom', description: 'comfortable pants' },
				{ name: 'shoes', description: 'everyday footwear' }
			],
			user: [
				{ name: 'top', description: 'casual shirt' },
				{ name: 'bottom', description: 'comfortable pants' },
				{ name: 'shoes', description: 'everyday footwear' }
			]
		};
	}
}

export const clothesGenerationService = new ClothesGenerationService();
