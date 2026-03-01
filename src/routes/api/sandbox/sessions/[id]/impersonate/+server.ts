import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sandboxService } from '$lib/server/services/sandboxService';
import { generateImpersonation } from '$lib/server/llm/impersonation';
import { llmSettingsService } from '$lib/server/services/llmSettingsService';
import type { ImpersonateStyle } from '$lib/types/chat';

// POST - Generate impersonation (AI writes as user) in sandbox context
export const POST: RequestHandler = async ({ params, cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const sessionId = parseInt(params.id!);
	if (isNaN(sessionId)) {
		return json({ error: 'Invalid session ID' }, { status: 400 });
	}

	try {
		const { style = 'impersonate' }: { style?: ImpersonateStyle } = await request.json();

		const session = await sandboxService.getSession(sessionId, parseInt(userId));
		if (!session) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		const character = await sandboxService.getCurrentCharacter(session);
		if (!character) {
			return json({ error: 'No character present' }, { status: 400 });
		}

		const history = await sandboxService.getMessages(sessionId);
		const settings = llmSettingsService.getSettings();

		const content = await generateImpersonation(
			history,
			character,
			settings,
			style,
			parseInt(userId)
		);

		return json({ content });
	} catch (error) {
		console.error('Failed to generate impersonation:', error);
		return json({ error: 'Failed to generate impersonation' }, { status: 500 });
	}
};
