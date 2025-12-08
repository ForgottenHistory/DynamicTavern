import { imageLlmSettingsService } from './imageLlmSettingsService';
import { callLlm } from './llmCallService';
import fs from 'fs/promises';
import path from 'path';

const TAG_LIBRARY_DIR = 'data';
const PROMPTS_DIR = 'data/prompts';

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
	async loadTagLibrary(userId: number): Promise<string> {
		try {
			const filePath = path.join(TAG_LIBRARY_DIR, `tags_${userId}.txt`);
			const content = await fs.readFile(filePath, 'utf-8');
			return content;
		} catch (error) {
			console.log('No tag library found for user, using empty');
			return '';
		}
	}

	/**
	 * Generate image tags using the Image LLM
	 * Can generate all tags or specific types (character, user, scene)
	 * @param type - Which tags to generate: 'all', 'character', 'user', or 'scene'
	 * @param imageTags - Always included tags (character appearance - hair, eyes, body)
	 * @param contextualTags - Character-specific tags the AI can choose from
	 */
	async generateTags({
		userId,
		conversationContext,
		characterName = '',
		imageTags = '',
		contextualTags = '',
		type = 'all'
	}: {
		userId: number;
		conversationContext: string;
		characterName?: string;
		imageTags?: string;
		contextualTags?: string;
		type?: 'all' | 'character' | 'user' | 'scene';
	}): Promise<{ generatedTags: string; alwaysTags: string; breakdown?: { character?: string; user?: string; scene?: string } }> {
		try {
			console.log(`🎨 Generating image tags (${type}) from conversation context...`);

			// Get user's Image LLM settings
			const settings = await imageLlmSettingsService.getUserSettings(userId);
			console.log(`🎨 Using Image LLM settings:`, {
				provider: settings.provider,
				model: settings.model,
				temperature: settings.temperature
			});

			// Load prompts and tag library
			const [prompts, tagLibrary] = await Promise.all([
				this.loadPrompts(),
				this.loadTagLibrary(userId)
			]);

			// Build base context for all prompts
			const baseContext = this.buildBaseContext({
				conversationContext,
				imageTags,
				contextualTags,
				characterName,
				tagLibrary
			});

			const breakdown: { character?: string; user?: string; scene?: string } = {};

			// Generate tags based on type
			if (type === 'all') {
				// Make three parallel LLM calls for character, user, and scene
				const [characterTags, userTags, sceneTags] = await Promise.all([
					this.callImageLLM({
						messages: [{ role: 'user', content: `${baseContext}\n\n${prompts.character}\n\nYour selected tags:` }],
						settings,
						tagType: 'character'
					}),
					this.callImageLLM({
						messages: [{ role: 'user', content: `${baseContext}\n\n${prompts.user}\n\nYour selected tags:` }],
						settings,
						tagType: 'user'
					}),
					this.callImageLLM({
						messages: [{ role: 'user', content: `${baseContext}\n\n${prompts.scene}\n\nYour selected tags:` }],
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
					messages: [{ role: 'user', content: `${baseContext}\n\n${prompts[type]}\n\nYour selected tags:` }],
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

	/**
	 * Build the base context shared by all three tag generation prompts
	 */
	private buildBaseContext({
		conversationContext,
		imageTags,
		contextualTags,
		characterName,
		tagLibrary
	}: {
		conversationContext: string;
		imageTags: string;
		contextualTags: string;
		characterName: string;
		tagLibrary: string;
	}): string {
		let context = '';

		if (tagLibrary) {
			context += `Here is the library of valid Danbooru tags you can choose from:

${tagLibrary}

---

`;
		}

		// Show character's base appearance (always included in final prompt)
		if (imageTags) {
			context += `${characterName || 'Character'}'s base appearance (these tags are ALWAYS included, do NOT repeat them):
${imageTags}

---

`;
		}

		// Show optional character-specific tags the AI can choose from
		if (contextualTags) {
			context += `Optional tags for ${characterName || 'this character'} (include these if relevant to the scene):
${contextualTags}

---

`;
		}

		context += `Recent conversation:
${conversationContext}

---

Based on the conversation, select appropriate Danbooru tags.`;

		return context;
	}
}

export const imageTagGenerationService = new ImageTagGenerationService();
