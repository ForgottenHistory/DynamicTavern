import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { contentLlmService, type ContentType } from '$lib/server/services/contentLlmService';

const VALID_TYPES: ContentType[] = ['description', 'personality', 'scenario', 'message_example', 'greeting'];

export const POST: RequestHandler = async ({ request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const { type, input } = await request.json();

		if (!type || !VALID_TYPES.includes(type)) {
			return json({ error: 'Invalid content type' }, { status: 400 });
		}

		if (!input || typeof input !== 'string' || input.trim().length === 0) {
			return json({ error: 'Input text is required' }, { status: 400 });
		}

		const rewritten = await contentLlmService.rewriteContent({
			userId: parseInt(userId),
			type,
			input
		});

		return json({ rewritten });
	} catch (error: any) {
		console.error('Content rewrite failed:', error);
		return json({ error: error.message || 'Failed to rewrite content' }, { status: 500 });
	}
};
