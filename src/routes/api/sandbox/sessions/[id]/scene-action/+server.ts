import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sandboxService } from '$lib/server/services/sandboxService';
import { generateNarration } from '$lib/server/llm/narration';
import { llmSettingsService } from '$lib/server/services/llmSettingsService';
import type { SceneActionType } from '$lib/types/chat';
import type { NarrationType } from '$lib/server/llm/promptUtils';

const validTypes: SceneActionType[] = ['look_character', 'look_scene', 'narrate', 'explore_scene', 'look_item'];

// POST - Execute a scene action in sandbox context
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
		const { actionType, itemContext } = await request.json() as {
			actionType: SceneActionType;
			itemContext?: { owner: string; itemName: string; itemDescription: string };
		};

		if (!actionType || !validTypes.includes(actionType)) {
			return json({ error: 'Invalid action type' }, { status: 400 });
		}

		// look_item requires itemContext
		if (actionType === 'look_item' && !itemContext) {
			return json({ error: 'Item context required for look_item action' }, { status: 400 });
		}

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

		const narrateType: NarrationType = actionType;
		const result = await generateNarration(
			history,
			character,
			settings,
			narrateType,
			undefined, // no conversationId
			itemContext, // itemContext for look_item
			undefined, // no scenarioOverride
			parseInt(userId)
		);

		// Save as narrator message
		await sandboxService.addMessage(sessionId, parseInt(userId), {
			role: 'narrator',
			content: result.content,
			senderName: 'Narrator',
			reasoning: result.reasoning
		});

		const messages = await sandboxService.getMessages(sessionId);

		return json({ success: true, messages });
	} catch (error) {
		console.error('Failed to execute scene action:', error);
		return json({ error: 'Failed to execute scene action' }, { status: 500 });
	}
};
