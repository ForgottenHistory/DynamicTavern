import { json, type RequestHandler } from '@sveltejs/kit';
import { scenarioService } from '$lib/server/services/scenarioService';

// GET - Get all scenarios
export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const scenarios = await scenarioService.getAll();
		return json({ scenarios });
	} catch (error) {
		console.error('Failed to load scenarios:', error);
		return json({ error: 'Failed to load scenarios' }, { status: 500 });
	}
};
