import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sandboxService } from '$lib/server/services/sandboxService';
import { worldService } from '$lib/server/services/worldService';

// GET - Get session state
export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const sessionId = parseInt(params.id!);
	if (isNaN(sessionId)) {
		return json({ error: 'Invalid session ID' }, { status: 400 });
	}

	try {
		const session = await sandboxService.getSession(sessionId, parseInt(userId));
		if (!session) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		const world = await worldService.get(session.worldFile);
		if (!world) {
			return json({ error: 'World not found' }, { status: 404 });
		}

		const location = worldService.getLocation(world, session.currentLocationId);
		const activeCharacters = await sandboxService.getActiveCharacters(sessionId);
		// Legacy fallback: if no participants but session has currentCharacterId
		let character: typeof activeCharacters[0] | null = activeCharacters[0] || null;
		if (activeCharacters.length === 0 && session.currentCharacterId) {
			character = await sandboxService.getCurrentCharacter(session);
		}
		const messages = await sandboxService.getMessages(sessionId);
		const connections = worldService.getConnections(world, session.currentLocationId);

		return json({
			session,
			world,
			location,
			character,
			characters: activeCharacters,
			messages,
			connections
		});
	} catch (error) {
		console.error('Failed to get session:', error);
		return json({ error: 'Failed to get session' }, { status: 500 });
	}
};

// DELETE - Delete a session
export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const sessionId = parseInt(params.id!);
	if (isNaN(sessionId)) {
		return json({ error: 'Invalid session ID' }, { status: 400 });
	}

	try {
		const deleted = await sandboxService.deleteSession(sessionId, parseInt(userId));
		if (!deleted) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete session:', error);
		return json({ error: 'Failed to delete session' }, { status: 500 });
	}
};
