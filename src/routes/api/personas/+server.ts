import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { personaService } from '$lib/server/services/personaService';

// GET /api/personas - Get all personas for the current user
export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const personas = await personaService.getUserPersonas(parseInt(userId));
		const activePersona = await personaService.getActivePersona(parseInt(userId));

		return json({
			personas,
			activePersonaId: activePersona?.id || null
		});
	} catch (error) {
		console.error('Failed to get personas:', error);
		return json({ error: 'Failed to get personas' }, { status: 500 });
	}
};

// POST /api/personas - Create a new persona
export const POST: RequestHandler = async ({ cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const data = await request.json();

		if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
			return json({ error: 'Name is required' }, { status: 400 });
		}

		const persona = await personaService.createPersona(parseInt(userId), {
			name: data.name.trim(),
			description: data.description?.trim() || undefined,
			avatarData: data.avatarData || undefined
		});

		return json({ persona }, { status: 201 });
	} catch (error) {
		console.error('Failed to create persona:', error);
		return json({ error: 'Failed to create persona' }, { status: 500 });
	}
};
