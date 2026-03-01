import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sandboxService } from '$lib/server/services/sandboxService';

// DELETE - Delete a sandbox message and all messages after it
export const DELETE: RequestHandler = async ({ params, cookies }) => {
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
		const deleted = await sandboxService.deleteMessageAndAfter(messageId, sessionId, parseInt(userId));
		if (!deleted) {
			return json({ error: 'Message not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete sandbox messages:', error);
		return json({ error: 'Failed to delete messages' }, { status: 500 });
	}
};
