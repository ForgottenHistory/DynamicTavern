import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// POST - Reset conversation (delete conversation and all messages)
export const POST: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const conversationId = parseInt(params.conversationId);
	if (isNaN(conversationId)) {
		return json({ error: 'Invalid conversation ID' }, { status: 400 });
	}

	try {
		// Verify conversation belongs to user
		const [conversation] = await db
			.select()
			.from(conversations)
			.where(and(eq(conversations.id, conversationId), eq(conversations.userId, parseInt(userId))))
			.limit(1);

		if (!conversation) {
			return json({ error: 'Conversation not found' }, { status: 404 });
		}

		// Delete all messages in the conversation
		await db.delete(messages).where(eq(messages.conversationId, conversationId));

		// Delete the conversation itself
		await db.delete(conversations).where(eq(conversations.id, conversationId));

		return json({ success: true });
	} catch (error) {
		console.error('Failed to reset conversation:', error);
		return json({ error: 'Failed to reset conversation' }, { status: 500 });
	}
};
