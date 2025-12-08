import { db } from '../db';
import { llmSettings } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { LlmSettings } from '../db/schema';

/**
 * Default LLM settings used when user hasn't configured their own
 */
const DEFAULT_SETTINGS = {
	provider: 'openrouter',
	model: 'anthropic/claude-3.5-sonnet',
	temperature: 0.7,
	maxTokens: 500,
	topP: 1.0,
	frequencyPenalty: 0.0,
	presencePenalty: 0.0,
	contextWindow: 8000,
	reasoningEnabled: false,
	// Featherless-specific parameters
	topK: -1,
	minP: 0.0,
	repetitionPenalty: 1.0
};

class LlmSettingsService {
	/**
	 * Get user's LLM settings, or return defaults if not configured
	 */
	async getUserSettings(userId: number): Promise<LlmSettings> {
		const settings = await db
			.select()
			.from(llmSettings)
			.where(eq(llmSettings.userId, userId))
			.limit(1);

		if (settings[0]) {
			return settings[0];
		}

		// Return defaults with userId
		return {
			id: 0, // Indicates no DB record
			userId,
			...DEFAULT_SETTINGS
		};
	}

	/**
	 * Create or update user's LLM settings
	 */
	async updateUserSettings(
		userId: number,
		settings: Partial<Omit<LlmSettings, 'id' | 'userId'>>
	): Promise<LlmSettings> {
		// Check if settings exist
		const existing = await db
			.select()
			.from(llmSettings)
			.where(eq(llmSettings.userId, userId))
			.limit(1);

		if (existing[0]) {
			// Update existing
			const updated = await db
				.update(llmSettings)
				.set(settings)
				.where(eq(llmSettings.userId, userId))
				.returning();
			return updated[0];
		} else {
			// Create new
			const created = await db
				.insert(llmSettings)
				.values({
					userId,
					...DEFAULT_SETTINGS,
					...settings
				})
				.returning();
			return created[0];
		}
	}

	/**
	 * Get default settings (useful for system/orchestrator calls)
	 */
	getDefaultSettings() {
		return { ...DEFAULT_SETTINGS };
	}
}

export const llmSettingsService = new LlmSettingsService();
