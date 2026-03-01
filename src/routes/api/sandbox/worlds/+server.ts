import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { worldService } from '$lib/server/services/worldService';

// GET - List all available worlds
export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const worlds = await worldService.getAll();
		return json({ worlds });
	} catch (error) {
		console.error('Failed to get worlds:', error);
		return json({ error: 'Failed to get worlds' }, { status: 500 });
	}
};
