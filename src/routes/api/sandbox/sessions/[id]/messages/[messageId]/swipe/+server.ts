import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { messages } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { sandboxService } from '$lib/server/services/sandboxService';

// POST - Change to a different swipe variant
export const POST: RequestHandler = async ({ params, cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const sessionId = parseInt(params.id!);
	const messageId = parseInt(params.messageId!);
	if (isNaN(sessionId) || isNaN(messageId)) {
		return json({ error: 'Invalid ID' }, { status: 400 });
	}

	try {
		const { swipeIndex } = await request.json();

		if (typeof swipeIndex !== 'number' || swipeIndex < 0) {
			return json({ error: 'Invalid swipe index' }, { status: 400 });
		}

		// Verify ownership
		const session = await sandboxService.getSession(sessionId, parseInt(userId));
		if (!session) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		const [message] = await db
			.select()
			.from(messages)
			.where(
				and(
					eq(messages.id, messageId),
					eq(messages.sandboxSessionId, sessionId)
				)
			)
			.limit(1);

		if (!message) {
			return json({ error: 'Message not found' }, { status: 404 });
		}

		// Parse swipes
		const swipes = message.swipes ? JSON.parse(message.swipes) : [message.content];

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
		console.error('Failed to swipe sandbox message:', error);
		return json({ error: 'Failed to swipe message' }, { status: 500 });
	}
};
