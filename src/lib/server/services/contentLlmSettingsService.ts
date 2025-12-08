import { llmSettingsFileService, type LlmSettingsData } from './llmSettingsFileService';

class ContentLlmSettingsService {
	/**
	 * Get content LLM settings
	 */
	getSettings(): LlmSettingsData {
		return llmSettingsFileService.getSettings('content');
	}

	/**
	 * Update content LLM settings
	 */
	updateSettings(settings: Partial<LlmSettingsData>): LlmSettingsData {
		return llmSettingsFileService.updateSettings('content', settings);
	}

	/**
	 * Get default settings
	 */
	getDefaultSettings(): LlmSettingsData {
		return llmSettingsFileService.getDefaultSettings('content');
	}
}

export const contentLlmSettingsService = new ContentLlmSettingsService();
