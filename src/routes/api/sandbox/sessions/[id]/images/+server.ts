import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sandboxService } from '$lib/server/services/sandboxService';
import { sandboxImageService } from '$lib/server/services/sandboxImageService';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const sessionId = parseInt(params.id!);
	if (isNaN(sessionId)) {
		return json({ error: 'Invalid session ID' }, { status: 400 });
	}

	const session = await sandboxService.getSession(sessionId, parseInt(userId));
	if (!session) {
		return json({ error: 'Session not found' }, { status: 404 });
	}

	const images = await sandboxImageService.list(sessionId);
	return json({ images });
};
