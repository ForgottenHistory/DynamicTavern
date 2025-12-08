import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data/settings';
const SETTINGS_FILE = 'llm-settings.json';
const PRESETS_FILE = 'llm-presets.json';

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
	mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * LLM Settings structure for each type
 */
export interface LlmSettingsData {
	provider: string;
	model: string;
	temperature: number;
	maxTokens: number;
	topP: number;
	frequencyPenalty: number;
	presencePenalty: number;
	contextWindow: number;
	reasoningEnabled: boolean;
	topK: number;
	minP: number;
	repetitionPenalty: number;
}

/**
 * All LLM settings grouped by type
 */
export interface AllLlmSettings {
	chat: LlmSettingsData;
	decision: LlmSettingsData;
	content: LlmSettingsData;
	image: LlmSettingsData;
}

/**
 * LLM Preset structure
 */
export interface LlmPreset {
	id: string;
	name: string;
	provider: string;
	model: string;
	temperature: number;
	maxTokens: number;
	topP: number;
	frequencyPenalty: number;
	presencePenalty: number;
	contextWindow: number;
	reasoningEnabled: boolean;
	topK: number;
	minP: number;
	repetitionPenalty: number;
	createdAt: string;
}

/**
 * Default settings for each LLM type
 */
const DEFAULT_SETTINGS: AllLlmSettings = {
	chat: {
		provider: 'openrouter',
		model: 'anthropic/claude-3.5-sonnet',
		temperature: 0.7,
		maxTokens: 500,
		topP: 1.0,
		frequencyPenalty: 0.0,
		presencePenalty: 0.0,
		contextWindow: 8000,
		reasoningEnabled: false,
		topK: -1,
		minP: 0.0,
		repetitionPenalty: 1.0
	},
	decision: {
		provider: 'openrouter',
		model: 'anthropic/claude-3.5-sonnet',
		temperature: 0.3,
		maxTokens: 200,
		topP: 1.0,
		frequencyPenalty: 0.0,
		presencePenalty: 0.0,
		contextWindow: 4000,
		reasoningEnabled: false,
		topK: -1,
		minP: 0.0,
		repetitionPenalty: 1.0
	},
	content: {
		provider: 'openrouter',
		model: 'anthropic/claude-3.5-sonnet',
		temperature: 0.8,
		maxTokens: 2000,
		topP: 1.0,
		frequencyPenalty: 0.0,
		presencePenalty: 0.0,
		contextWindow: 16000,
		reasoningEnabled: false,
		topK: -1,
		minP: 0.0,
		repetitionPenalty: 1.0
	},
	image: {
		provider: 'openrouter',
		model: 'openai/gpt-4o-mini',
		temperature: 1.0,
		maxTokens: 1000,
		topP: 1.0,
		frequencyPenalty: 0.0,
		presencePenalty: 0.0,
		contextWindow: 4000,
		reasoningEnabled: false,
		topK: -1,
		minP: 0.0,
		repetitionPenalty: 1.0
	}
};

class LlmSettingsFileService {
	private settingsPath = join(DATA_DIR, SETTINGS_FILE);
	private presetsPath = join(DATA_DIR, PRESETS_FILE);

	/**
	 * Get all LLM settings
	 */
	getAllSettings(): AllLlmSettings {
		try {
			if (existsSync(this.settingsPath)) {
				const data = readFileSync(this.settingsPath, 'utf-8');
				const parsed = JSON.parse(data);
				// Merge with defaults to ensure all fields exist
				return {
					chat: { ...DEFAULT_SETTINGS.chat, ...parsed.chat },
					decision: { ...DEFAULT_SETTINGS.decision, ...parsed.decision },
					content: { ...DEFAULT_SETTINGS.content, ...parsed.content },
					image: { ...DEFAULT_SETTINGS.image, ...parsed.image }
				};
			}
		} catch (err) {
			console.error('Failed to read LLM settings file:', err);
		}
		return { ...DEFAULT_SETTINGS };
	}

	/**
	 * Get settings for a specific LLM type
	 */
	getSettings(type: keyof AllLlmSettings): LlmSettingsData {
		const all = this.getAllSettings();
		return all[type];
	}

	/**
	 * Update settings for a specific LLM type
	 */
	updateSettings(type: keyof AllLlmSettings, settings: Partial<LlmSettingsData>): LlmSettingsData {
		const all = this.getAllSettings();
		all[type] = { ...all[type], ...settings };
		this.saveSettings(all);
		return all[type];
	}

	/**
	 * Save all settings to file
	 */
	private saveSettings(settings: AllLlmSettings): void {
		try {
			writeFileSync(this.settingsPath, JSON.stringify(settings, null, '\t'), 'utf-8');
		} catch (err) {
			console.error('Failed to save LLM settings file:', err);
			throw err;
		}
	}

	/**
	 * Get default settings for a type
	 */
	getDefaultSettings(type: keyof AllLlmSettings): LlmSettingsData {
		return { ...DEFAULT_SETTINGS[type] };
	}

	// ===== Presets =====

	/**
	 * Get all presets
	 */
	getAllPresets(): LlmPreset[] {
		try {
			if (existsSync(this.presetsPath)) {
				const data = readFileSync(this.presetsPath, 'utf-8');
				return JSON.parse(data);
			}
		} catch (err) {
			console.error('Failed to read presets file:', err);
		}
		return [];
	}

	/**
	 * Get a preset by ID
	 */
	getPreset(id: string): LlmPreset | null {
		const presets = this.getAllPresets();
		return presets.find(p => p.id === id) || null;
	}

	/**
	 * Create or update a preset
	 */
	savePreset(preset: Omit<LlmPreset, 'id' | 'createdAt'> & { id?: string }): LlmPreset {
		const presets = this.getAllPresets();

		// Check if preset with same name exists
		const existingByName = presets.findIndex(p => p.name === preset.name);
		const existingById = preset.id ? presets.findIndex(p => p.id === preset.id) : -1;

		const now = new Date().toISOString();
		const newPreset: LlmPreset = {
			id: preset.id || crypto.randomUUID(),
			name: preset.name,
			provider: preset.provider,
			model: preset.model,
			temperature: preset.temperature,
			maxTokens: preset.maxTokens,
			topP: preset.topP,
			frequencyPenalty: preset.frequencyPenalty,
			presencePenalty: preset.presencePenalty,
			contextWindow: preset.contextWindow,
			reasoningEnabled: preset.reasoningEnabled,
			topK: preset.topK ?? -1,
			minP: preset.minP ?? 0.0,
			repetitionPenalty: preset.repetitionPenalty ?? 1.0,
			createdAt: now
		};

		if (existingById >= 0) {
			// Update by ID
			newPreset.createdAt = presets[existingById].createdAt;
			presets[existingById] = newPreset;
		} else if (existingByName >= 0) {
			// Update by name
			newPreset.id = presets[existingByName].id;
			newPreset.createdAt = presets[existingByName].createdAt;
			presets[existingByName] = newPreset;
		} else {
			// Create new
			presets.push(newPreset);
		}

		this.savePresets(presets);
		return newPreset;
	}

	/**
	 * Delete a preset
	 */
	deletePreset(id: string): boolean {
		const presets = this.getAllPresets();
		const index = presets.findIndex(p => p.id === id);

		if (index >= 0) {
			presets.splice(index, 1);
			this.savePresets(presets);
			return true;
		}
		return false;
	}

	/**
	 * Save all presets to file
	 */
	private savePresets(presets: LlmPreset[]): void {
		try {
			writeFileSync(this.presetsPath, JSON.stringify(presets, null, '\t'), 'utf-8');
		} catch (err) {
			console.error('Failed to save presets file:', err);
			throw err;
		}
	}
}

export const llmSettingsFileService = new LlmSettingsFileService();
