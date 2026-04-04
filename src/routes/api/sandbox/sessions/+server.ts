import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sandboxService } from '$lib/server/services/sandboxService';
import { worldService } from '$lib/server/services/worldService';

// GET - Get user's sandbox sessions
export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const sessions = await sandboxService.getUserSessions(parseInt(userId));

		// Enrich sessions with world/location names
		const enriched = await Promise.all(
			sessions.map(async (session) => {
				if (session.mode === 'dynamic') {
					return {
						...session,
						worldName: 'Dynamic Adventure',
						locationName: session.dynamicLocationName || 'Starting...'
					};
				}
				const world = await worldService.get(session.worldFile);
				const location = world ? worldService.getLocation(world, session.currentLocationId) : null;
				return {
					...session,
					worldName: world?.name || session.worldFile,
					locationName: location?.name || session.currentLocationId
				};
			})
		);

		return json({ sessions: enriched });
	} catch (error) {
		console.error('Failed to get sessions:', error);
		return json({ error: 'Failed to get sessions' }, { status: 500 });
	}
};

// POST - Create a new sandbox session
export const POST: RequestHandler = async ({ cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const { worldFile, mode, theme } = await request.json();

		// Dynamic mode: no world file needed
		if (mode === 'dynamic') {
			const session = await sandboxService.createDynamicSession(parseInt(userId), theme);
			return json({ session, world: null, location: null });
		}

		if (!worldFile) {
			return json({ error: 'World file required' }, { status: 400 });
		}

		const result = await sandboxService.createSession(parseInt(userId), worldFile);
		if (!result) {
			return json({ error: 'Failed to create session - world not found' }, { status: 404 });
		}

		const { session, world } = result;
		const location = worldService.getLocation(world, session.currentLocationId);

		return json({
			session,
			world,
			location
		});
	} catch (error) {
		console.error('Failed to create session:', error);
		return json({ error: 'Failed to create session' }, { status: 500 });
	}
};
