import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { messages, conversations } from '$lib/server/db/schema';
import { eq, and, gte } from 'drizzle-orm';

// DELETE - Delete a message and all messages after it
export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const messageId = parseInt(params.messageId);
	if (isNaN(messageId)) {
		return json({ error: 'Invalid message ID' }, { status: 400 });
	}

	try {
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

		// Delete this message and all messages after it in the same conversation
		await db
			.delete(messages)
			.where(and(
				eq(messages.conversationId, message.message.conversationId),
				gte(messages.id, messageId)
			));

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete messages:', error);
		return json({ error: 'Failed to delete messages' }, { status: 500 });
	}
};
