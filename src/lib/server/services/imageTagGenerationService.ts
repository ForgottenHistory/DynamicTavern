import { imageLlmSettingsService } from './imageLlmSettingsService';
import { callLlm } from './llmCallService';
import { personaService } from './personaService';
import { worldInfoService, type WorldInfo } from './worldInfoService';
import fs from 'fs/promises';
import path from 'path';

/**
 * Helper to extract clothes text from world info for a specific entity
 */
function formatClothesForPrompt(worldInfo: WorldInfo | null, entityName: string): string {
	const entity = worldInfo?.worldState?.[entityName];
	if (!entity?.attributes) return '';

	const clothesAttr = entity.attributes.find(a => a.name === 'clothes' && a.type === 'list');
	if (!clothesAttr || !Array.isArray(clothesAttr.value)) return '';

	return clothesAttr.value
		.map((item: { name: string; description: string }) => `${item.name}: ${item.description}`)
		.join(', ');
}

const TAG_LIBRARY_DIR = 'data';
const PROMPTS_DIR = 'data/prompts';

/**
 * Replace template variables in prompts (consistent with llm.ts)
 */
function replaceTemplateVariables(
	template: string,
	variables: {
		char: string;
		user: string;
		description: string;
		scenario: string;
		history: string;
		image_tags: string;
		contextual_tags: string;
		tag_library: string;
		world: string;
		char_clothes: string;
		user_clothes: string;
	}
): string {
	return template
		.replace(/\{\{char\}\}/g, variables.char)
		.replace(/\{\{user\}\}/g, variables.user)
		.replace(/\{\{description\}\}/g, variables.description)
		.replace(/\{\{scenario\}\}/g, variables.scenario)
		.replace(/\{\{history\}\}/g, variables.history)
		.replace(/\{\{image_tags\}\}/g, variables.image_tags)
		.replace(/\{\{contextual_tags\}\}/g, variables.contextual_tags)
		.replace(/\{\{tag_library\}\}/g, variables.tag_library)
		.replace(/\{\{world\}\}/g, variables.world)
		.replace(/\{\{char_clothes\}\}/g, variables.char_clothes)
		.replace(/\{\{user_clothes\}\}/g, variables.user_clothes);
}

class ImageTagGenerationService {

	/**
	 * Load image prompts from files (always reads fresh from disk)
	 */
	async loadPrompts(): Promise<{ character: string; user: string; scene: string }> {
		const defaults = {
			character: 'Generate Danbooru tags for the character. Focus on expression, pose, clothing with colors. Output ONLY comma-separated tags.',
			user: 'Generate Danbooru tags for user presence/POV. Output "none" if user not visible. Output ONLY comma-separated tags.',
			scene: 'Generate Danbooru tags for the scene. Include composition tag (close-up, upper body, etc.), location, lighting. Output ONLY comma-separated tags.'
		};

		const loadPrompt = async (name: 'character' | 'user' | 'scene'): Promise<string> => {
			try {
				const content = await fs.readFile(path.join(PROMPTS_DIR, `image_${name}.txt`), 'utf-8');
				return content.trim();
			} catch (error) {
				console.error(`Failed to load image_${name}.txt, using default:`, error);
				return defaults[name];
			}
		};

		const [character, user, scene] = await Promise.all([
			loadPrompt('character'),
			loadPrompt('user'),
			loadPrompt('scene')
		]);

		return { character, user, scene };
	}

	/**
	 * Load tag library for a user (always reads fresh from disk)
	 */
	async loadTagLibrary(userId?: number): Promise<string> {
		try {
			// Use user-specific tag library if userId provided
			const filename = userId ? `tags_${userId}.txt` : 'tags.txt';
			const filePath = path.join(TAG_LIBRARY_DIR, filename);
			const content = await fs.readFile(filePath, 'utf-8');
			return content;
		} catch (error) {
			console.log('No tag library found, using empty');
			return '';
		}
	}

	/**
	 * Generate image tags using the Image LLM
	 * Can generate all tags or specific types (character, user, scene)
	 * @param type - Which tags to generate: 'all', 'character', 'user', or 'scene'
	 * @param imageTags - Always included tags (character appearance - hair, eyes, body)
	 * @param contextualTags - Character-specific tags the AI can choose from
	 * @param userId - User ID for loading user-specific tag library
	 * @param conversationId - Conversation ID for loading world info
	 */
	async generateTags({
		conversationContext,
		characterName = '',
		characterDescription = '',
		characterScenario = '',
		imageTags = '',
		contextualTags = '',
		type = 'all',
		userId,
		conversationId
	}: {
		conversationContext: string;
		characterName?: string;
		characterDescription?: string;
		characterScenario?: string;
		imageTags?: string;
		contextualTags?: string;
		type?: 'all' | 'character' | 'user' | 'scene';
		userId?: number;
		conversationId?: number;
	}): Promise<{ generatedTags: string; alwaysTags: string; breakdown?: { character?: string; user?: string; scene?: string } }> {
		try {
			console.log(`🎨 Generating image tags (${type}) from conversation context...`);

			// Get Image LLM settings from file
			const settings = imageLlmSettingsService.getSettings();
			console.log(`🎨 Using Image LLM settings:`, {
				provider: settings.provider,
				model: settings.model,
				temperature: settings.temperature
			});

			// Load prompts, tag library, user info, and world info
			const [prompts, tagLibrary, userInfo, worldInfo] = await Promise.all([
				this.loadPrompts(),
				this.loadTagLibrary(userId),
				userId ? personaService.getActiveUserInfo(userId) : Promise.resolve({ name: 'User', description: null, avatarData: null }),
				conversationId ? worldInfoService.getWorldInfo(conversationId) : Promise.resolve(null)
			]);

			const userName = userInfo.name;
			const worldText = worldInfoService.formatWorldInfoForPrompt(worldInfo, characterName, userName);
			const charClothesText = formatClothesForPrompt(worldInfo, 'character');
			const userClothesText = formatClothesForPrompt(worldInfo, 'user');

			if (tagLibrary) {
				console.log(`🎨 Loaded tag library for user ${userId} (${tagLibrary.split('\n').length} lines)`);
			} else {
				console.log(`🎨 No tag library found for user ${userId}`);
			}

			// Prepare template variables for prompt replacement
			const templateVars = {
				char: characterName || 'Character',
				user: userName,
				description: characterDescription || '',
				scenario: characterScenario || '',
				history: conversationContext || '',
				image_tags: imageTags || '',
				contextual_tags: contextualTags || '',
				tag_library: tagLibrary || '',
				world: worldText,
				char_clothes: charClothesText,
				user_clothes: userClothesText
			};

			// Replace template variables in prompts
			const processedPrompts = {
				character: replaceTemplateVariables(prompts.character, templateVars),
				user: replaceTemplateVariables(prompts.user, templateVars),
				scene: replaceTemplateVariables(prompts.scene, templateVars)
			};

			const breakdown: { character?: string; user?: string; scene?: string } = {};

			// Generate tags based on type
			if (type === 'all') {
				// Make three parallel LLM calls for character, user, and scene
				const [characterTags, userTags, sceneTags] = await Promise.all([
					this.callImageLLM({
						messages: [{ role: 'user', content: processedPrompts.character }],
						settings,
						tagType: 'character'
					}),
					this.callImageLLM({
						messages: [{ role: 'user', content: processedPrompts.user }],
						settings,
						tagType: 'user'
					}),
					this.callImageLLM({
						messages: [{ role: 'user', content: processedPrompts.scene }],
						settings,
						tagType: 'scene'
					})
				]);

				breakdown.character = characterTags.trim();
				breakdown.user = userTags.trim();
				breakdown.scene = sceneTags.trim();

				console.log('🤖 Character tags:', breakdown.character);
				console.log('🤖 User tags:', breakdown.user);
				console.log('🤖 Scene tags:', breakdown.scene);
			} else {
				// Generate only the requested type
				const tags = await this.callImageLLM({
					messages: [{ role: 'user', content: processedPrompts[type] }],
					settings,
					tagType: type
				});
				breakdown[type] = tags.trim();
				console.log(`🤖 ${type} tags:`, breakdown[type]);
			}

			// Combine all generated tags, filtering out "none" responses and deduplicating
			const rawTags = Object.values(breakdown)
				.filter((tags): tags is string => !!tags && tags.toLowerCase() !== 'none' && tags.length > 0)
				.join(', ');

			// Deduplicate tags (split by comma, trim, remove duplicates, rejoin)
			const tagSet = new Set(
				rawTags.split(',')
					.map(tag => tag.trim())
					.filter(tag => tag.length > 0)
			);
			const allTags = Array.from(tagSet).join(', ');

			console.log('🎨 Combined generated tags:', allTags);
			console.log('🎨 Always included tags:', imageTags);

			return {
				generatedTags: allTags,
				alwaysTags: imageTags, // These are always included in the final prompt
				breakdown
			};
		} catch (error: any) {
			console.error('❌ Failed to generate image tags:', error.message);
			return { generatedTags: '', alwaysTags: imageTags };
		}
	}

	/**
	 * Call Image LLM with specific settings
	 */
	private async callImageLLM({
		messages,
		settings,
		tagType = 'image'
	}: {
		messages: { role: string; content: string }[];
		settings: any;
		tagType?: string;
	}): Promise<string> {
		const result = await callLlm({
			messages,
			settings,
			logType: `image-${tagType}`,
			logCharacterName: 'Image LLM'
		});
		return result.content;
	}

}

export const imageTagGenerationService = new ImageTagGenerationService();
