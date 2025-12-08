import { db } from '../db';
import { decisionEngineSettings } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { DecisionEngineSettings } from '../db/schema';

/**
 * Default decision engine settings - lower temperature for more deterministic decisions
 */
const DEFAULT_SETTINGS = {
	provider: 'openrouter',
	model: 'anthropic/claude-3.5-sonnet',
	temperature: 0.3,
	maxTokens: 200,
	topP: 1.0,
	frequencyPenalty: 0.0,
	presencePenalty: 0.0,
	contextWindow: 4000,
	reasoningEnabled: false,
	// Featherless-specific parameters
	topK: -1,
	minP: 0.0,
	repetitionPenalty: 1.0
};

class DecisionEngineSettingsService {
	/**
	 * Get user's decision engine settings, or return defaults if not configured
	 */
	async getUserSettings(userId: number): Promise<DecisionEngineSettings> {
		const settings = await db
			.select()
			.from(decisionEngineSettings)
			.where(eq(decisionEngineSettings.userId, userId))
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
	 * Create or update user's decision engine settings
	 */
	async updateUserSettings(
		userId: number,
		settings: Partial<Omit<DecisionEngineSettings, 'id' | 'userId'>>
	): Promise<DecisionEngineSettings> {
		// Check if settings exist
		const existing = await db
			.select()
			.from(decisionEngineSettings)
			.where(eq(decisionEngineSettings.userId, userId))
			.limit(1);

		if (existing[0]) {
			// Update existing
			const updated = await db
				.update(decisionEngineSettings)
				.set(settings)
				.where(eq(decisionEngineSettings.userId, userId))
				.returning();
			return updated[0];
		} else {
			// Create new
			const created = await db
				.insert(decisionEngineSettings)
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
	 * Get default settings
	 */
	getDefaultSettings() {
		return { ...DEFAULT_SETTINGS };
	}
}

export const decisionEngineSettingsService = new DecisionEngineSettingsService();
