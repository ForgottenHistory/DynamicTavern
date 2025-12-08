import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { messages, conversations } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// POST - Change to a different swipe variant
export const POST: RequestHandler = async ({ params, cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const messageId = parseInt(params.messageId);
	if (isNaN(messageId)) {
		return json({ error: 'Invalid message ID' }, { status: 400 });
	}

	try {
		const { swipeIndex } = await request.json();

		if (typeof swipeIndex !== 'number' || swipeIndex < 0) {
			return json({ error: 'Invalid swipe index' }, { status: 400 });
		}

		// Get the message and verify ownership
		const [message] = await db
			.select({
				message: messages,
				conversation: conversations
			})
			.from(messages)
			.innerJoin(conversations, eq(messages.conversationId, conversations.id))
			.where(and(
				eq(messages.id, messageId),
				eq(conversations.userId, parseInt(userId))
			))
			.limit(1);

		if (!message) {
			return json({ error: 'Message not found' }, { status: 404 });
		}

		// Parse swipes
		const swipes = message.message.swipes ? JSON.parse(message.message.swipes) : [message.message.content];

		if (swipeIndex >= swipes.length) {
			return json({ error: 'Swipe index out of range' }, { status: 400 });
		}

		// Update the current swipe index and content
		await db
			.update(messages)
			.set({
				currentSwipe: swipeIndex,
				content: swipes[swipeIndex]
			})
			.where(eq(messages.id, messageId));

		return json({ success: true });
	} catch (error) {
		console.error('Failed to swipe message:', error);
		return json({ error: 'Failed to swipe message' }, { status: 500 });
	}
};
