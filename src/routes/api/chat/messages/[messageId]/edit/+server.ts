import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { messages, conversations } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// POST - Edit a message's content
export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const messageId = parseInt(params.messageId!);
	if (isNaN(messageId)) {
		return json({ error: 'Invalid message ID' }, { status: 400 });
	}

	const body = await request.json();
	const { content } = body;

	if (!content || typeof content !== 'string') {
		return json({ error: 'Content is required' }, { status: 400 });
	}

	try {
		// Get the message and verify ownership
		const [existingMessage] = await db
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

		if (!existingMessage) {
			return json({ error: 'Message not found' }, { status: 404 });
		}

		// Update the message content
		// Also update the current swipe in the swipes array if it exists
		let updatedSwipes = existingMessage.message.swipes;
		if (updatedSwipes) {
			try {
				const swipesArray = JSON.parse(updatedSwipes);
				if (Array.isArray(swipesArray)) {
					const currentIndex = existingMessage.message.currentSwipe ?? 0;
					swipesArray[currentIndex] = content;
					updatedSwipes = JSON.stringify(swipesArray);
				}
			} catch {
				// If parsing fails, just update the content
			}
		}

		const [updatedMessage] = await db
			.update(messages)
			.set({
				content,
				swipes: updatedSwipes
			})
			.where(eq(messages.id, messageId))
			.returning();

		return json({ message: updatedMessage });
	} catch (error) {
		console.error('Failed to edit message:', error);
		return json({ error: 'Failed to edit message' }, { status: 500 });
	}
};
