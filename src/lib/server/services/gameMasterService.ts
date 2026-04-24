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
	| { type: 'generate_image'; reason?: string }
	| { type: 'update_location'; location_name: string; location_description: string; reason?: string }
	| { type: 'refresh_world_state'; reason?: string };

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
		} else if (current.type === 'update_location' && current.location_name && current.location_description) {
			actions.push({
				type: 'update_location',
				location_name: current.location_name,
				location_description: current.location_description,
				reason: current.reason
			});
		} else if (current.type === 'refresh_world_state') {
			actions.push({ type: 'refresh_world_state', reason: current.reason });
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
	worldStateSummary: string;
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
		.replace(/\{\{character_description\}\}/g, params.characterDescription || '')
		.replace(/\{\{world_state\}\}/g, params.worldStateSummary || '(none)');

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
 * After each user message, ask the GM what actions (if any) to take:
 *   - update_location: scene should move
 *   - refresh_world_state: world state looks stale or empty
 * Returns an action list that the caller dispatches. Never throws.
 */
export async function decidePerMessageActions(params: {
	currentLocationName: string;
	currentLocationDescription: string;
	recentMessages: { role: string; content: string; senderName?: string | null }[];
	worldStateSummary: string; // Human-readable snapshot or "(none)" if empty
	theme?: string | null;
}): Promise<GameMasterAction[]> {
	const settings = gameMasterSettingsService.getSettings();

	const systemPrompt = await loadPrompt(
		'gameMaster_dynamic_check.txt',
		`You are the Game Master for a dynamic sandbox roleplay session. After each user message, decide which actions (if any) to take.

Current location: {{location_name}}
{{location_description}}

Current world state:
{{world_state}}

Possible actions:
  - update_location: the scene has clearly moved to a new place
  - refresh_world_state: the tracked attributes (clothes, mood, position, etc.) are empty or no longer match what's happening

Return zero or more actions as YAML:

actions:
  - type: update_location
    location_name: new location name
    location_description: vivid 2-3 sentence description
    reason: brief explanation
  - type: refresh_world_state
    reason: what changed

If nothing needs to change, return:
actions: []`
	);

	let processedPrompt = systemPrompt
		.replace(/\{\{location_name\}\}/g, params.currentLocationName)
		.replace(/\{\{location_description\}\}/g, params.currentLocationDescription)
		.replace(/\{\{world_state\}\}/g, params.worldStateSummary);

	if (params.theme) {
		processedPrompt += `\n\nWorld theme: ${params.theme}. Any new locations must fit this setting.`;
	}

	const conversationContext = params.recentMessages
		.map(m => `${m.senderName || m.role}: ${m.content}`)
		.join('\n');

	try {
		const result = await callLlm({
			messages: [
				{ role: 'system', content: processedPrompt },
				{ role: 'user', content: `Recent conversation:\n${conversationContext}\n\nWhat should happen now?` }
			],
			settings,
			logType: 'game_master',
			logCharacterName: 'Game Master',
			timeout: 30000
		});

		return parseActionList(result.content);
	} catch (error) {
		console.error('Game Master per-message decision failed:', error);
		return [];
	}
}
