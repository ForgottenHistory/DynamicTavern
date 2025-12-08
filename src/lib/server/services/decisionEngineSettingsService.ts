import { llmSettingsFileService, type LlmSettingsData } from './llmSettingsFileService';

class DecisionEngineSettingsService {
	/**
	 * Get decision engine settings
	 */
	getSettings(): LlmSettingsData {
		return llmSettingsFileService.getSettings('decision');
	}

	/**
	 * Update decision engine settings
	 */
	updateSettings(settings: Partial<LlmSettingsData>): LlmSettingsData {
		return llmSettingsFileService.updateSettings('decision', settings);
	}

	/**
	 * Get default settings
	 */
	getDefaultSettings(): LlmSettingsData {
		return llmSettingsFileService.getDefaultSettings('decision');
	}
}

export const decisionEngineSettingsService = new DecisionEngineSettingsService();
