import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages, characters, llmSettings } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateChatCompletion } from '$lib/server/llm';
import { emitMessage, emitTyping } from '$lib/server/socket';

// POST - Generate AI response without user message
export const POST: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.characterId);
	if (isNaN(characterId)) {
		return json({ error: 'Invalid character ID' }, { status: 400 });
	}

	try {
		// Find active conversation (branch)
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
			return json({ error: 'Conversation not found' }, { status: 404 });
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

		let aiResult: { content: string; reasoning: string | null };
		try {
			// Generate AI response
			aiResult = await generateChatCompletion(
				conversationHistory,
				character,
				settings,
				'chat'
			);
		} catch (genError) {
			// Stop typing indicator on generation error
			emitTyping(conversation.id, false);
			throw genError;
		}

		// Stop typing indicator
		emitTyping(conversation.id, false);

		// Save AI response with character info
		const [assistantMessage] = await db
			.insert(messages)
			.values({
				conversationId: conversation.id,
				role: 'assistant',
				content: aiResult.content,
				senderName: character.name,
				senderAvatar: character.thumbnailData || character.imageData,
				reasoning: aiResult.reasoning
			})
			.returning();

		// Emit assistant message via Socket.IO
		emitMessage(conversation.id, assistantMessage);

		return json({ message: assistantMessage });
	} catch (error) {
		console.error('Failed to generate response:', error);
		return json({ error: 'Failed to generate response' }, { status: 500 });
	}
};
