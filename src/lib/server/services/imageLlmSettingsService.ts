import { db } from '../db';
import { imageLlmSettings } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { ImageLlmSettings } from '../db/schema';

/**
 * Default image LLM settings for image generation
 */
const DEFAULT_SETTINGS = {
	provider: 'openrouter',
	model: 'openai/gpt-4o-mini',
	temperature: 1.0,
	maxTokens: 1000,
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

class ImageLlmSettingsService {
	async getUserSettings(userId: number): Promise<ImageLlmSettings> {
		const settings = await db
			.select()
			.from(imageLlmSettings)
			.where(eq(imageLlmSettings.userId, userId))
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
		settings: Partial<Omit<ImageLlmSettings, 'id' | 'userId'>>
	): Promise<ImageLlmSettings> {
		const existing = await db
			.select()
			.from(imageLlmSettings)
			.where(eq(imageLlmSettings.userId, userId))
			.limit(1);

		if (existing[0]) {
			const updated = await db
				.update(imageLlmSettings)
				.set(settings)
				.where(eq(imageLlmSettings.userId, userId))
				.returning();
			return updated[0];
		} else {
			const created = await db
				.insert(imageLlmSettings)
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

export const imageLlmSettingsService = new ImageLlmSettingsService();
