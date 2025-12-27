import fs from 'fs/promises';
import path from 'path';
import type { ImpersonateStyle } from '$lib/types/chat';

/**
 * Default system prompt used when file doesn't exist
 */
export const DEFAULT_SYSTEM_PROMPT = `You are {{char}}.

{{description}}

Personality: {{personality}}

Scenario: {{scenario}}

Write your next reply as {{char}} in this roleplay chat with {{user}}.`;

export const DEFAULT_IMPERSONATE_PROMPT = `Write the next message as {{user}} in this roleplay chat with {{char}}.

Stay in character as {{user}}. Write a natural response that fits the conversation flow.`;

export const DEFAULT_NARRATION_PROMPTS: Record<string, string> = {
	look_character: `You are a narrator. Briefly describe {{char}}'s current appearance and expression. Keep it to 2-3 sentences.`,
	look_scene: `You are a narrator. Briefly describe the current environment. Keep it to 2-3 sentences.`,
	narrate: `You are a narrator. Briefly describe what is happening in the scene. Keep it to 2-3 sentences.`,
	look_item: `You are a narrator. Briefly describe {{item_owner}}'s {{item_name}} in detail. Keep it to 2-3 sentences.`,
	explore_scene: `You are a narrator. {{user}} looks around and explores the environment. Describe something interesting they notice or discover - an object, detail, or feature of the scene they hadn't focused on before. Keep it to 2-3 sentences.`,
	enter_scene: `You are a narrator. {{character_name}} has just entered the scene. Briefly describe their entrance in 1-2 sentences.`,
	leave_scene: `You are a narrator. {{character_name}} is leaving the scene. Briefly describe their departure in 1-2 sentences.`,
	scene_intro: `You are a narrator. The following characters are present: {{character_names}}. Describe the scene opening in 2-3 sentences.`
};

export const PROMPTS_DIR = path.join(process.cwd(), 'data', 'prompts');
export const SYSTEM_PROMPT_FILE = path.join(PROMPTS_DIR, 'chat_system.txt');
export const IMPERSONATE_PROMPT_FILE = path.join(PROMPTS_DIR, 'chat_impersonate.txt');
export const WRITING_STYLE_FILE = path.join(PROMPTS_DIR, 'writing_style.txt');

export type NarrationType = 'look_character' | 'look_scene' | 'narrate' | 'look_item' | 'explore_scene' | 'enter_scene' | 'leave_scene' | 'scene_intro';

export interface WorldStateVariables {
	mood?: string;
	position?: string;
	clothes?: string;
}

export interface TemplateVariables {
	char: string;
	user: string;
	personality: string;
	scenario: string;
	description: string;
	world?: string;
	post_history?: string;
	writing_style?: string;
	// World state (for conditionals)
	world_sidebar?: boolean;
	char_mood?: string;
	char_position?: string;
	char_clothes?: string;
}

/**
 * Load system prompt from file
 */
export async function loadSystemPromptFromFile(): Promise<string> {
	try {
		return await fs.readFile(SYSTEM_PROMPT_FILE, 'utf-8');
	} catch (error) {
		// File doesn't exist, return default
		return DEFAULT_SYSTEM_PROMPT;
	}
}

/**
 * Load impersonate prompt from file based on style
 */
export async function loadImpersonatePromptFromFile(style: ImpersonateStyle = 'impersonate'): Promise<string> {
	try {
		// For 'impersonate' style, use the default file; for others, use style-specific files
		const filename = style === 'impersonate' ? 'chat_impersonate.txt' : `impersonate_${style}.txt`;
		const filePath = path.join(PROMPTS_DIR, filename);
		return await fs.readFile(filePath, 'utf-8');
	} catch (error) {
		// File doesn't exist, return default
		return DEFAULT_IMPERSONATE_PROMPT;
	}
}

/**
 * Load writing style from file
 */
export async function loadWritingStyle(): Promise<string> {
	try {
		return await fs.readFile(WRITING_STYLE_FILE, 'utf-8');
	} catch (error) {
		// File doesn't exist, return empty
		return '';
	}
}

/**
 * Load narration prompt from file
 */
export async function loadNarrationPromptFromFile(type: NarrationType): Promise<string> {
	try {
		const filePath = path.join(PROMPTS_DIR, `action_${type}.txt`);
		return await fs.readFile(filePath, 'utf-8');
	} catch (error) {
		// File doesn't exist, return default
		return DEFAULT_NARRATION_PROMPTS[type] || DEFAULT_NARRATION_PROMPTS.narrate;
	}
}

/**
 * Process conditional blocks in template
 * Supports: {{#if variable}}...{{/if}} and {{#unless variable}}...{{/unless}}
 */
function processConditionals(template: string, variables: Record<string, any>): string {
	let result = template;

	// Process {{#if variable}}...{{/if}} blocks
	// Use non-greedy matching and handle nested content
	const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
	result = result.replace(ifRegex, (match, varName, content) => {
		const value = variables[varName];
		// Truthy check: exists and not empty string
		if (value && value !== '') {
			return content;
		}
		return '';
	});

	// Process {{#unless variable}}...{{/unless}} blocks (inverse of if)
	const unlessRegex = /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g;
	result = result.replace(unlessRegex, (match, varName, content) => {
		const value = variables[varName];
		// Show if falsy or empty
		if (!value || value === '') {
			return content;
		}
		return '';
	});

	return result;
}

/**
 * Replace template variables with actual values
 * Processes conditionals first, then replaces variables
 */
export function replaceTemplateVariables(
	template: string,
	variables: TemplateVariables
): string {
	// Build a lookup object for conditionals
	const lookup: Record<string, any> = {
		char: variables.char,
		user: variables.user,
		personality: variables.personality,
		scenario: variables.scenario,
		description: variables.description,
		world: variables.world,
		post_history: variables.post_history,
		writing_style: variables.writing_style,
		world_sidebar: variables.world_sidebar,
		char_mood: variables.char_mood,
		char_position: variables.char_position,
		char_clothes: variables.char_clothes
	};

	// Process conditionals first
	let result = processConditionals(template, lookup);

	// Then replace variables
	return result
		.replace(/\{\{char\}\}/g, variables.char)
		.replace(/\{\{user\}\}/g, variables.user)
		.replace(/\{\{personality\}\}/g, variables.personality)
		.replace(/\{\{scenario\}\}/g, variables.scenario)
		.replace(/\{\{description\}\}/g, variables.description)
		.replace(/\{\{world\}\}/g, variables.world || '')
		.replace(/\{\{post_history\}\}/g, variables.post_history || '')
		.replace(/\{\{writing_style\}\}/g, variables.writing_style || '')
		.replace(/\{\{char_mood\}\}/g, variables.char_mood || '')
		.replace(/\{\{char_position\}\}/g, variables.char_position || '')
		.replace(/\{\{char_clothes\}\}/g, variables.char_clothes || '');
}
