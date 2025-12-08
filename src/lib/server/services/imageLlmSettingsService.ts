import { llmSettingsFileService, type LlmSettingsData } from './llmSettingsFileService';

class ImageLlmSettingsService {
	/**
	 * Get image LLM settings
	 */
	getSettings(): LlmSettingsData {
		return llmSettingsFileService.getSettings('image');
	}

	/**
	 * Update image LLM settings
	 */
	updateSettings(settings: Partial<LlmSettingsData>): LlmSettingsData {
		return llmSettingsFileService.updateSettings('image', settings);
	}

	/**
	 * Get default settings
	 */
	getDefaultSettings(): LlmSettingsData {
		return llmSettingsFileService.getDefaultSettings('image');
	}
}

export const imageLlmSettingsService = new ImageLlmSettingsService();
