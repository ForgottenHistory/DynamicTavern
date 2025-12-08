import { llmSettingsFileService, type LlmSettingsData } from './llmSettingsFileService';

class LlmSettingsService {
	/**
	 * Get LLM settings for chat
	 */
	getSettings(): LlmSettingsData {
		return llmSettingsFileService.getSettings('chat');
	}

	/**
	 * Update LLM settings for chat
	 */
	updateSettings(settings: Partial<LlmSettingsData>): LlmSettingsData {
		return llmSettingsFileService.updateSettings('chat', settings);
	}

	/**
	 * Get default settings
	 */
	getDefaultSettings(): LlmSettingsData {
		return llmSettingsFileService.getDefaultSettings('chat');
	}
}

export const llmSettingsService = new LlmSettingsService();
