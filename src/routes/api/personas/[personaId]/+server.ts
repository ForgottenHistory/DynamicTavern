import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { personaService } from '$lib/server/services/personaService';

// GET /api/personas/:personaId - Get a specific persona
export const GET: RequestHandler = async ({ cookies, params }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const personaId = parseInt(params.personaId);
	if (isNaN(personaId)) {
		return json({ error: 'Invalid persona ID' }, { status: 400 });
	}

	try {
		const persona = await personaService.getPersonaById(personaId, parseInt(userId));

		if (!persona) {
			return json({ error: 'Persona not found' }, { status: 404 });
		}

		return json({ persona });
	} catch (error) {
		console.error('Failed to get persona:', error);
		return json({ error: 'Failed to get persona' }, { status: 500 });
	}
};

// PUT /api/personas/:personaId - Update a persona
export const PUT: RequestHandler = async ({ cookies, params, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const personaId = parseInt(params.personaId);
	if (isNaN(personaId)) {
		return json({ error: 'Invalid persona ID' }, { status: 400 });
	}

	try {
		const data = await request.json();

		const updateData: { name?: string; description?: string; avatarData?: string } = {};

		if (data.name !== undefined) {
			if (typeof data.name !== 'string' || data.name.trim().length === 0) {
				return json({ error: 'Name cannot be empty' }, { status: 400 });
			}
			updateData.name = data.name.trim();
		}

		if (data.description !== undefined) {
			updateData.description = data.description?.trim() || null;
		}

		if (data.avatarData !== undefined) {
			updateData.avatarData = data.avatarData || null;
		}

		const persona = await personaService.updatePersona(personaId, parseInt(userId), updateData);

		if (!persona) {
			return json({ error: 'Persona not found' }, { status: 404 });
		}

		return json({ persona });
	} catch (error) {
		console.error('Failed to update persona:', error);
		return json({ error: 'Failed to update persona' }, { status: 500 });
	}
};

// DELETE /api/personas/:personaId - Delete a persona
export const DELETE: RequestHandler = async ({ cookies, params }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const personaId = parseInt(params.personaId);
	if (isNaN(personaId)) {
		return json({ error: 'Invalid persona ID' }, { status: 400 });
	}

	try {
		const deleted = await personaService.deletePersona(personaId, parseInt(userId));

		if (!deleted) {
			return json({ error: 'Persona not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete persona:', error);
		return json({ error: 'Failed to delete persona' }, { status: 500 });
	}
};
