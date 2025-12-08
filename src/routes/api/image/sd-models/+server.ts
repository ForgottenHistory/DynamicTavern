import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sdService } from '$lib/server/services/sdService';

/**
 * GET /api/image/sd-models
 * Get available models from Stable Diffusion server
 */
export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');

	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const models = await sdService.getModels();

		return json({ models });
	} catch (error: any) {
		console.error('Failed to get SD models:', error);
		return json({ models: [] });
	}
};
