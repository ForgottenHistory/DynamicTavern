import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { sceneService } from '$lib/server/services/sceneService';

// GET - Get all characters in a scene/conversation
export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const conversationId = parseInt(params.conversationId!);
	if (isNaN(conversationId)) {
		return json({ error: 'Invalid conversation ID' }, { status: 400 });
	}

	try {
		// Verify conversation belongs to user
		const [conversation] = await db
			.select()
			.from(conversations)
			.where(
				and(
					eq(conversations.id, conversationId),
					eq(conversations.userId, parseInt(userId))
				)
			)
			.limit(1);

		if (!conversation) {
			return json({ error: 'Conversation not found' }, { status: 404 });
		}

		const activeCharacters = await sceneService.getActiveCharacters(conversationId);
		const allCharacters = await sceneService.getAllCharacters(conversationId);

		return json({
			active: activeCharacters,
			all: allCharacters,
			primaryCharacterId: conversation.primaryCharacterId
		});
	} catch (error) {
		console.error('Failed to get scene characters:', error);
		return json({ error: 'Failed to get scene characters' }, { status: 500 });
	}
};
