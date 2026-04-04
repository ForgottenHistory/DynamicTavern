import { llmSettingsFileService, type LlmSettingsData } from './llmSettingsFileService';

class GameMasterSettingsService {
	/**
	 * Get game master LLM settings
	 */
	getSettings(): LlmSettingsData {
		return llmSettingsFileService.getSettings('gameMaster');
	}

	/**
	 * Update game master LLM settings
	 */
	updateSettings(settings: Partial<LlmSettingsData>): LlmSettingsData {
		return llmSettingsFileService.updateSettings('gameMaster', settings);
	}

	/**
	 * Get default settings
	 */
	getDefaultSettings(): LlmSettingsData {
		return llmSettingsFileService.getDefaultSettings('gameMaster');
	}
}

export const gameMasterSettingsService = new GameMasterSettingsService();
