import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { messages, conversations, characters, llmSettings } from '$lib/server/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { generateChatCompletion } from '$lib/server/llm';
import { emitMessage, emitTyping } from '$lib/server/socket';

// POST - Regenerate message fresh (delete old message and create completely new one)
export const POST: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const messageId = parseInt(params.messageId);
	if (isNaN(messageId)) {
		return json({ error: 'Invalid message ID' }, { status: 400 });
	}

	try {
		// Get the message and verify ownership
		const [messageData] = await db
			.select({
				message: messages,
				conversation: conversations
			})
			.from(messages)
			.innerJoin(conversations, eq(messages.conversationId, conversations.id))
			.where(and(
				eq(messages.id, messageId),
				eq(conversations.userId, parseInt(userId))
			))
			.limit(1);

		if (!messageData) {
			return json({ error: 'Message not found' }, { status: 404 });
		}

		const { message, conversation } = messageData;

		// Only allow regenerating assistant messages
		if (message.role !== 'assistant') {
			return json({ error: 'Can only regenerate assistant messages' }, { status: 400 });
		}

		// Get character
		const [character] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, conversation.characterId))
			.limit(1);

		if (!character) {
			return json({ error: 'Character not found' }, { status: 404 });
		}

		// Get conversation history up to this message (excluding the message being regenerated)
		const conversationHistory = await db
			.select()
			.from(messages)
			.where(and(
				eq(messages.conversationId, conversation.id),
				lt(messages.id, messageId)
			))
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

		// Delete the old message
		await db.delete(messages).where(eq(messages.id, messageId));

		// Emit typing indicator
		emitTyping(conversation.id, true);

		let result: { content: string; reasoning: string | null };
		try {
			// Generate new response
			result = await generateChatCompletion(
				conversationHistory,
				character,
				settings,
				'regenerate' // message type for logging
			);
		} catch (genError) {
			// Stop typing indicator on generation error
			emitTyping(conversation.id, false);
			throw genError;
		}

		// Stop typing indicator
		emitTyping(conversation.id, false);

		// Create completely new message
		const [newMessage] = await db
			.insert(messages)
			.values({
				conversationId: conversation.id,
				role: 'assistant',
				content: result.content,
				senderName: character.name,
				senderAvatar: character.thumbnailData || character.imageData,
				reasoning: result.reasoning
			})
			.returning();

		// Emit new message via Socket.IO
		emitMessage(conversation.id, newMessage);

		return json({ success: true, content: result.content, message: newMessage });
	} catch (error) {
		console.error('Failed to regenerate message fresh:', error);
		return json({ error: 'Failed to regenerate message' }, { status: 500 });
	}
};
