import { gameMasterSettingsService } from './gameMasterSettingsService';
import { callLlm } from './llmCallService';
import fs from 'fs/promises';
import path from 'path';
import type { DynamicLocation } from '$lib/types/sandbox';

const PROMPTS_DIR = 'data/prompts';

async function loadPrompt(filename: string, fallback: string): Promise<string> {
	try {
		const content = await fs.readFile(path.join(PROMPTS_DIR, filename), 'utf-8');
		return content.trim();
	} catch {
		return fallback;
	}
}

/**
 * Parse simple YAML key-value pairs from LLM response.
 * Handles: "key: value" lines, strips code fences, supports multi-word values.
 */
function parseYaml(text: string): Record<string, string> {
	const cleaned = text.replace(/```ya?ml\n?|\n?```/g, '').trim();
	const result: Record<string, string> = {};

	for (const line of cleaned.split('\n')) {
		const match = line.match(/^(\w+):\s*(.+)$/);
		if (match) {
			result[match[1]] = match[2].trim();
		}
	}

	return result;
}

/**
 * Generate the initial location for a new dynamic sandbox session
 */
export async function generateInitialDynamicLocation(theme?: string | null): Promise<DynamicLocation> {
	const settings = gameMasterSettingsService.getSettings();

	const systemPrompt = await loadPrompt(
		'gameMaster_dynamic_init.txt',
		`You are the Game Master for a sandbox roleplay session. Generate an interesting starting location for a new adventure.

Respond with YAML only:
name: Location Name
description: A vivid 2-3 sentence description of the location, setting the atmosphere.`
	);

	const themeInstruction = theme ? `The world theme is: ${theme}. Generate a location that fits this setting.` : 'Generate a starting location for a new adventure.';

	const result = await callLlm({
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: themeInstruction }
		],
		settings,
		logType: 'game_master',
		logCharacterName: 'Game Master'
	});

	try {
		const parsed = parseYaml(result.content);
		if (parsed.name && parsed.description) {
			return { name: parsed.name, description: parsed.description };
		}
	} catch {
		// fallback
	}

	return {
		name: 'A Quiet Clearing',
		description: 'You stand in a peaceful clearing surrounded by tall trees. Sunlight filters through the canopy above, casting dappled shadows on the soft ground.'
	};
}

export type GameMasterAction =
	| { type: 'generate_image'; reason?: string };

/**
 * Parse a YAML action list of the form:
 *   actions:
 *     - type: generate_image
 *       reason: ...
 * Tolerant of missing fences and extra whitespace.
 */
function parseActionList(text: string): GameMasterAction[] {
	const cleaned = text.replace(/```ya?ml\n?|\n?```/g, '').trim();
	const lines = cleaned.split('\n');

	const actions: GameMasterAction[] = [];
	let current: Record<string, string> | null = null;

	const flush = () => {
		if (!current) return;
		if (current.type === 'generate_image') {
			actions.push({ type: 'generate_image', reason: current.reason });
		}
		current = null;
	};

	for (const rawLine of lines) {
		const line = rawLine.replace(/\t/g, '  ');
		const itemMatch = line.match(/^\s*-\s*type:\s*(\S+)\s*$/);
		if (itemMatch) {
			flush();
			current = { type: itemMatch[1] };
			continue;
		}
		const kvMatch = line.match(/^\s{2,}(\w+):\s*(.+)$/);
		if (kvMatch && current) {
			current[kvMatch[1]] = kvMatch[2].trim();
		}
	}
	flush();
	return actions;
}

/**
 * Decide which actions to take when a character enters the scene.
 * Returns an (often empty) list of actions. Never throws.
 */
export async function decideOnCharacterEntered(params: {
	locationName: string;
	locationDescription: string;
	characterName: string;
	characterDescription: string;
}): Promise<GameMasterAction[]> {
	const settings = gameMasterSettingsService.getSettings();

	const systemPrompt = await loadPrompt(
		'gameMaster_character_entered.txt',
		`You are the Game Master. A character has entered the scene. Respond with a YAML actions list.

actions:
  - type: generate_image
    reason: short reason`
	);

	const processedPrompt = systemPrompt
		.replace(/\{\{location_name\}\}/g, params.locationName || '')
		.replace(/\{\{location_description\}\}/g, params.locationDescription || '')
		.replace(/\{\{character_name\}\}/g, params.characterName || '')
		.replace(/\{\{character_description\}\}/g, params.characterDescription || '');

	try {
		const result = await callLlm({
			messages: [
				{ role: 'system', content: processedPrompt },
				{ role: 'user', content: 'Decide actions for this entrance.' }
			],
			settings,
			logType: 'game_master',
			logCharacterName: 'Game Master',
			timeout: 30000
		});
		return parseActionList(result.content);
	} catch (error) {
		console.error('Game Master character-entry decision failed:', error);
		return [];
	}
}

/**
 * Check if the location should update based on recent conversation
 */
export async function checkForLocationUpdate(
	currentLocationName: string,
	currentLocationDescription: string,
	recentMessages: { role: string; content: string; senderName?: string | null }[],
	theme?: string | null
): Promise<{ shouldUpdate: boolean; newLocation?: DynamicLocation }> {
	const settings = gameMasterSettingsService.getSettings();

	const systemPrompt = await loadPrompt(
		'gameMaster_dynamic_check.txt',
		`You are the Game Master for a dynamic sandbox roleplay session. Analyze the recent conversation and decide if the location should change based on the narrative.

Current location: {{location_name}}
{{location_description}}

Only suggest a location change if the conversation clearly implies movement or a significant scene transition. Do NOT change location just because time passed or the topic shifted.

Respond with YAML only:
action: none or update_location
reason: brief explanation
location_name: new location name
location_description: vivid 2-3 sentence description`
	);

	// Replace template variables in prompt
	let processedPrompt = systemPrompt
		.replace(/\{\{location_name\}\}/g, currentLocationName)
		.replace(/\{\{location_description\}\}/g, currentLocationDescription);

	if (theme) {
		processedPrompt += `\n\nWorld theme: ${theme}. Any new locations must fit this setting.`;
	}

	// Format recent messages as conversation context
	const conversationContext = recentMessages
		.map(m => `${m.senderName || m.role}: ${m.content}`)
		.join('\n');

	try {
		const result = await callLlm({
			messages: [
				{ role: 'system', content: processedPrompt },
				{ role: 'user', content: `Recent conversation:\n${conversationContext}\n\nShould the location change?` }
			],
			settings,
			logType: 'game_master',
			logCharacterName: 'Game Master',
			timeout: 30000
		});

		const parsed = parseYaml(result.content);
		if (parsed.action === 'update_location' && parsed.location_name && parsed.location_description) {
			return {
				shouldUpdate: true,
				newLocation: {
					name: parsed.location_name,
					description: parsed.location_description
				}
			};
		}

		return { shouldUpdate: false };
	} catch (error) {
		console.error('Game Master location check failed:', error);
		return { shouldUpdate: false };
	}
}
