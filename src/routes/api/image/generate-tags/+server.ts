import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { imageTagGenerationService } from '$lib/server/services/imageTagGenerationService';

/**
 * POST /api/image/generate-tags
 * Generate image tags from conversation context using Image LLM
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const userId = cookies.get('userId');

	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const { conversationContext, characterName, imageTags, contextualTags } = await request.json();

		if (!conversationContext) {
			return json({ error: 'conversationContext is required' }, { status: 400 });
		}

		const result = await imageTagGenerationService.generateTags({
			userId: parseInt(userId),
			conversationContext,
			characterName: characterName || '',
			imageTags: imageTags || '', // Always included tags (character appearance)
			contextualTags: contextualTags || '' // AI chooses from these
		});

		return json({
			generatedTags: result.generatedTags,
			alwaysTags: result.alwaysTags
		});
	} catch (error: any) {
		console.error('Failed to generate image tags:', error);
		return json({ error: 'Failed to generate image tags' }, { status: 500 });
	}
};
