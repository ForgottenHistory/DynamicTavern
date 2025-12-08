import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages, characters, llmSettings } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateNarration, type NarrationType } from '$lib/server/llm';
import { emitMessage, emitTyping } from '$lib/server/socket';
import type { SceneActionType } from '$lib/types/chat';

// POST - Trigger a scene action (generates a system narration)
export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.characterId!);
	if (isNaN(characterId)) {
		return json({ error: 'Invalid character ID' }, { status: 400 });
	}

	try {
		const { actionType, itemContext } = await request.json() as {
			actionType: SceneActionType;
			itemContext?: { owner: string; itemName: string; itemDescription: string };
		};

		const validTypes: SceneActionType[] = ['look_character', 'look_scene', 'narrate', 'look_item'];
		if (!actionType || !validTypes.includes(actionType)) {
			return json({ error: 'Invalid action type' }, { status: 400 });
		}

		// look_item requires itemContext
		if (actionType === 'look_item' && !itemContext) {
			return json({ error: 'Item context required for look_item action' }, { status: 400 });
		}

		// Find active conversation
		const [conversation] = await db
			.select()
			.from(conversations)
			.where(
				and(
					eq(conversations.userId, parseInt(userId)),
					eq(conversations.characterId, characterId),
					eq(conversations.isActive, true)
				)
			)
			.limit(1);

		if (!conversation) {
			return json({ error: 'No active conversation' }, { status: 404 });
		}

		// Get character
		const [character] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, characterId))
			.limit(1);

		if (!character) {
			return json({ error: 'Character not found' }, { status: 404 });
		}

		// Get conversation history
		const conversationHistory = await db
			.select()
			.from(messages)
			.where(eq(messages.conversationId, conversation.id))
			.orderBy(messages.createdAt);

		// Get LLM settings
		const [settings] = await db
			.select()
			.from(llmSettings)
			.where(eq(llmSettings.userId, parseInt(userId)))
			.limit(1);

		if (!settings) {
			return json({ error: 'LLM settings not found' }, { status: 404 });
		}

		// Emit typing indicator
		emitTyping(conversation.id, true);

		let result: { content: string; reasoning: string | null };
		try {
			// Generate narration using the dedicated function
			// For look_item, pass the narration type as 'look_item' with item context
			const narrateType: NarrationType = actionType === 'look_item' ? 'look_item' : actionType;
			result = await generateNarration(
				conversationHistory,
				character,
				settings,
				narrateType,
				conversation.id,
				itemContext
			);
		} catch (genError) {
			emitTyping(conversation.id, false);
			throw genError;
		}

		// Stop typing indicator
		emitTyping(conversation.id, false);

		// Save as system message
		const [systemNarration] = await db
			.insert(messages)
			.values({
				conversationId: conversation.id,
				role: 'system',
				content: result.content,
				senderName: 'System',
				senderAvatar: null,
				reasoning: result.reasoning
			})
			.returning();

		// Emit system narration via Socket.IO
		emitMessage(conversation.id, systemNarration);

		return json({ success: true });
	} catch (error) {
		console.error('Failed to execute scene action:', error);
		return json({ error: 'Failed to execute scene action' }, { status: 500 });
	}
};
