import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages, characters } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateNarration, type NarrationType } from '$lib/server/llm';
import { emitMessage, emitTyping } from '$lib/server/socket';
import type { SceneActionType } from '$lib/types/chat';
import { llmSettingsService } from '$lib/server/services/llmSettingsService';

// POST - Trigger a scene action (generates a system narration)
export const POST: RequestHandler = async ({ request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const { actionType, itemContext, characterId, conversationId } = await request.json() as {
			actionType: SceneActionType;
			itemContext?: { owner: string; itemName: string; itemDescription: string };
			characterId?: number;
			conversationId: number;
		};

		if (!conversationId) {
			return json({ error: 'Conversation ID required' }, { status: 400 });
		}

		const validTypes: SceneActionType[] = ['look_character', 'look_scene', 'narrate', 'look_item'];
		if (!actionType || !validTypes.includes(actionType)) {
			return json({ error: 'Invalid action type' }, { status: 400 });
		}

		// look_item requires itemContext
		if (actionType === 'look_item' && !itemContext) {
			return json({ error: 'Item context required for look_item action' }, { status: 400 });
		}

		// Find conversation by ID
		const [conversation] = await db
			.select()
			.from(conversations)
			.where(
				and(
					eq(conversations.id, conversationId),
					eq(conversations.userId, parseInt(userId))
				)
			)
			.limit(1);

		if (!conversation) {
			return json({ error: 'Conversation not found' }, { status: 404 });
		}

		// Get target character - use characterId from body if provided, otherwise use conversation's primary character
		const targetCharacterId = characterId ?? conversation.primaryCharacterId ?? conversation.characterId;
		if (!targetCharacterId) {
			return json({ error: 'No character specified' }, { status: 400 });
		}

		const [character] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, targetCharacterId))
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

		// Get LLM settings from file service
		const settings = llmSettingsService.getSettings();

		// Emit typing indicator
		emitTyping(conversation.id, true);

		let result: { content: string; reasoning: string | null };
		try {
			// Generate narration using the dedicated function
			const narrateType: NarrationType = actionType === 'look_item' ? 'look_item' : actionType;
			result = await generateNarration(
				conversationHistory,
				character,
				settings,
				narrateType,
				conversation.id,
				itemContext,
				conversation.scenario,
				parseInt(userId)
			);
		} catch (genError) {
			emitTyping(conversation.id, false);
			throw genError;
		}

		// Stop typing indicator
		emitTyping(conversation.id, false);

		// Save as narrator message
		const [narratorMessage] = await db
			.insert(messages)
			.values({
				conversationId: conversation.id,
				role: 'narrator',
				content: result.content,
				senderName: 'Narrator',
				senderAvatar: null,
				reasoning: result.reasoning
			})
			.returning();

		// Emit narrator message via Socket.IO
		emitMessage(conversation.id, narratorMessage);

		return json({ success: true });
	} catch (error) {
		console.error('Failed to execute scene action:', error);
		return json({ error: 'Failed to execute scene action' }, { status: 500 });
	}
};
