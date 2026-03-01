import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sandboxService } from '$lib/server/services/sandboxService';

// POST - Edit a sandbox message's content
export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const sessionId = parseInt(params.id!);
	const messageId = parseInt(params.messageId!);
	if (isNaN(sessionId) || isNaN(messageId)) {
		return json({ error: 'Invalid ID' }, { status: 400 });
	}

	const body = await request.json();
	const { content } = body;

	if (!content || typeof content !== 'string') {
		return json({ error: 'Content is required' }, { status: 400 });
	}

	try {
		const updated = await sandboxService.editMessage(messageId, sessionId, parseInt(userId), content);
		if (!updated) {
			return json({ error: 'Message not found' }, { status: 404 });
		}

		return json({ message: updated });
	} catch (error) {
		console.error('Failed to edit sandbox message:', error);
		return json({ error: 'Failed to edit message' }, { status: 500 });
	}
};
