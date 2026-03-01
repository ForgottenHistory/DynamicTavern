import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { sandboxSessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { sandboxService } from '$lib/server/services/sandboxService';
import { worldService } from '$lib/server/services/worldService';
import { generateSandboxNarration } from '$lib/server/llm/sandboxNarration';
import { personaService } from '$lib/server/services/personaService';

// POST - Move to a new location
export const POST: RequestHandler = async ({ params, cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const sessionId = parseInt(params.id!);
	if (isNaN(sessionId)) {
		return json({ error: 'Invalid session ID' }, { status: 400 });
	}

	try {
		const { locationId } = await request.json();

		if (!locationId) {
			return json({ error: 'Location ID required' }, { status: 400 });
		}

		const result = await sandboxService.moveToLocation(sessionId, parseInt(userId), locationId);
		if (!result) {
			return json({ error: 'Invalid move - location not connected or session not found' }, { status: 400 });
		}

		const { session, character } = result;

		const world = await worldService.get(session.worldFile);
		if (!world) {
			return json({ error: 'World not found' }, { status: 404 });
		}

		const location = worldService.getLocation(world, locationId);
		const connections = worldService.getConnections(world, locationId);

		// Clear world state for the new location
		await db
			.update(sandboxSessions)
			.set({ worldInfo: null })
			.where(eq(sandboxSessions.id, sessionId));

		// Generate narrator description of the location
		const userInfo = await personaService.getActiveUserInfo(parseInt(userId));
		const narration = await generateSandboxNarration({
			userId: parseInt(userId),
			locationType: 'enter',
			locationName: location?.name || locationId,
			locationDescription: location?.description || '',
			userName: userInfo.name,
			character: character
				? {
						name: character.name,
						description: character.description || ''
					}
				: null
		});

		// Add narrator message to session
		await sandboxService.addMessage(sessionId, parseInt(userId), {
			role: 'narrator',
			content: narration.content,
			senderName: 'Narrator',
			reasoning: narration.reasoning
		});

		// Get updated messages
		const messages = await sandboxService.getMessages(sessionId);

		return json({
			session,
			world,
			location,
			character,
			messages,
			connections,
			narration: narration.content
		});
	} catch (error) {
		console.error('Failed to move:', error);
		return json({ error: 'Failed to move to location' }, { status: 500 });
	}
};
