import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sdService } from '$lib/server/services/sdService';

/**
 * GET /api/image/sd-status
 * Check if Stable Diffusion server is available
 */
export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');

	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const isHealthy = await sdService.checkHealth();

		return json({
			available: isHealthy,
			message: isHealthy ? 'SD server is available' : 'SD server is not available'
		});
	} catch (error: any) {
		console.error('Failed to check SD status:', error);
		return json({
			available: false,
			message: 'Failed to check SD server status'
		});
	}
};
