import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { worldService } from '$lib/server/services/worldService';

// GET - Get a specific world definition
export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const { worldId } = params;
	if (!worldId) {
		return json({ error: 'World ID required' }, { status: 400 });
	}

	try {
		const world = await worldService.get(worldId);
		if (!world) {
			return json({ error: 'World not found' }, { status: 404 });
		}

		return json({ world });
	} catch (error) {
		console.error('Failed to get world:', error);
		return json({ error: 'Failed to get world' }, { status: 500 });
	}
};
