import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sandboxService } from '$lib/server/services/sandboxService';
import { worldService } from '$lib/server/services/worldService';
import { generateInitialDynamicLocation } from '$lib/server/services/gameMasterService';

// POST - Initialize a new session with intro narration
export const POST: RequestHandler = async ({ params, cookies }) => {
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

		// Only init if no messages exist yet
		const existingMessages = await sandboxService.getMessages(sessionId);
		if (existingMessages.length > 0) {
			const activeCharacters = await sandboxService.getActiveCharacters(sessionId);
			return json({ messages: existingMessages, characters: activeCharacters });
		}

		let locationName: string;
		let locationDesc: string;

		if (session.mode === 'dynamic') {
			// Generate initial location via Game Master LLM
			const initialLocation = await generateInitialDynamicLocation(session.dynamicTheme);
			await sandboxService.updateDynamicLocation(
				sessionId, parseInt(userId),
				initialLocation.name, initialLocation.description
			);
			locationName = initialLocation.name;
			locationDesc = initialLocation.description;
		} else {
			// Scene mode: use world file
			const world = await worldService.get(session.worldFile);
			if (!world) {
				return json({ error: 'World not found' }, { status: 404 });
			}
			const location = worldService.getLocation(world, session.currentLocationId);
			locationName = location?.name || session.currentLocationId;
			locationDesc = location?.description || '';
		}

		const intro = `You find yourself in **${locationName}**. ${locationDesc}`;

		await sandboxService.addMessage(sessionId, parseInt(userId), {
			role: 'narrator',
			content: intro,
			senderName: 'Narrator'
		});

		const messages = await sandboxService.getMessages(sessionId);
		const activeCharacters = await sandboxService.getActiveCharacters(sessionId);

		return json({ messages, characters: activeCharacters });
	} catch (error) {
		console.error('Failed to init session:', error);
		return json({ error: 'Failed to init session' }, { status: 500 });
	}
};
