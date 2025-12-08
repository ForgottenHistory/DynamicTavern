import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { personaService } from '$lib/server/services/personaService';

// GET /api/personas/active - Get active persona info
export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const activeInfo = await personaService.getActiveUserInfo(parseInt(userId));
		const activePersona = await personaService.getActivePersona(parseInt(userId));

		return json({
			...activeInfo,
			personaId: activePersona?.id || null
		});
	} catch (error) {
		console.error('Failed to get active persona:', error);
		return json({ error: 'Failed to get active persona' }, { status: 500 });
	}
};

// POST /api/personas/active - Set active persona (or null for default profile)
export const POST: RequestHandler = async ({ cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const data = await request.json();
		const personaId = data.personaId === null ? null : parseInt(data.personaId);

		if (personaId !== null && isNaN(personaId)) {
			return json({ error: 'Invalid persona ID' }, { status: 400 });
		}

		const success = await personaService.setActivePersona(parseInt(userId), personaId);

		if (!success) {
			return json({ error: 'Persona not found' }, { status: 404 });
		}

		const activeInfo = await personaService.getActiveUserInfo(parseInt(userId));

		return json({
			success: true,
			...activeInfo,
			personaId
		});
	} catch (error) {
		console.error('Failed to set active persona:', error);
		return json({ error: 'Failed to set active persona' }, { status: 500 });
	}
};
