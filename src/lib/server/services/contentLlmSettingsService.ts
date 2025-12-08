import { db } from '../db';
import { contentLlmSettings } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { ContentLlmSettings } from '../db/schema';

/**
 * Default content LLM settings - higher temperature and tokens for creative content
 */
const DEFAULT_SETTINGS = {
	provider: 'openrouter',
	model: 'anthropic/claude-3.5-sonnet',
	temperature: 0.8,
	maxTokens: 2000,
	topP: 1.0,
	frequencyPenalty: 0.0,
	presencePenalty: 0.0,
	contextWindow: 16000,
	reasoningEnabled: false,
	// Featherless-specific parameters
	topK: -1,
	minP: 0.0,
	repetitionPenalty: 1.0
};

class ContentLlmSettingsService {
	async getUserSettings(userId: number): Promise<ContentLlmSettings> {
		const settings = await db
			.select()
			.from(contentLlmSettings)
			.where(eq(contentLlmSettings.userId, userId))
			.limit(1);

		if (settings[0]) {
			return settings[0];
		}

		return {
			id: 0,
			userId,
			...DEFAULT_SETTINGS
		};
	}

	async updateUserSettings(
		userId: number,
		settings: Partial<Omit<ContentLlmSettings, 'id' | 'userId'>>
	): Promise<ContentLlmSettings> {
		const existing = await db
			.select()
			.from(contentLlmSettings)
			.where(eq(contentLlmSettings.userId, userId))
			.limit(1);

		if (existing[0]) {
			const updated = await db
				.update(contentLlmSettings)
				.set(settings)
				.where(eq(contentLlmSettings.userId, userId))
				.returning();
			return updated[0];
		} else {
			const created = await db
				.insert(contentLlmSettings)
				.values({
					userId,
					...DEFAULT_SETTINGS,
					...settings
				})
				.returning();
			return created[0];
		}
	}

	getDefaultSettings() {
		return { ...DEFAULT_SETTINGS };
	}
}

export const contentLlmSettingsService = new ContentLlmSettingsService();
