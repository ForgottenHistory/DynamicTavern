import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sdService } from '$lib/server/services/sdService';

/**
 * POST /api/image/generate
 * Generate image using Stable Diffusion
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const userId = cookies.get('userId');

	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const {
			characterTags,
			contextTags,
			additionalPrompt,
			negativePrompt,
			settings,
			mainPromptOverride,
			negativePromptOverride
		} = await request.json();

		const result = await sdService.generateImage({
			characterTags,
			contextTags,
			additionalPrompt,
			negativePrompt,
			settings,
			mainPromptOverride,
			negativePromptOverride
		});

		if (!result.success) {
			return json({ error: result.error }, { status: 500 });
		}

		return json({
			success: true,
			imageBase64: result.imageBase64,
			prompt: result.prompt,
			negativePrompt: result.negativePrompt,
			generationTime: result.generationTime
		});
	} catch (error: any) {
		console.error('Failed to generate image:', error);
		return json({ error: 'Failed to generate image' }, { status: 500 });
	}
};
