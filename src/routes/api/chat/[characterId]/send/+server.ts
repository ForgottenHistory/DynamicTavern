import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages, characters, llmSettings } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateChatCompletion } from '$lib/server/llm';
import { emitMessage, emitTyping } from '$lib/server/socket';
import { personaService } from '$lib/server/services/personaService';

// POST - Send a message and get AI response
export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.characterId);
	if (isNaN(characterId)) {
		return json({ error: 'Invalid character ID' }, { status: 400 });
	}

	try {
		const { message } = await request.json();

		if (!message || !message.trim()) {
			return json({ error: 'Message is required' }, { status: 400 });
		}

		// Find active conversation (branch) or create one
		let [conversation] = await db
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
			[conversation] = await db
				.insert(conversations)
				.values({
					userId: parseInt(userId),
					characterId,
					isActive: true
				})
				.returning();
		}

		// Get active persona info for sender details
		const userInfo = await personaService.getActiveUserInfo(parseInt(userId));

		// Save user message with sender info
		const [userMessage] = await db
			.insert(messages)
			.values({
				conversationId: conversation.id,
				role: 'user',
				content: message.trim(),
				senderName: userInfo.name,
				senderAvatar: userInfo.avatarData
			})
			.returning();

		// Emit user message immediately via Socket.IO
		emitMessage(conversation.id, userMessage);

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
				'chat' // message type for logging
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

		// Fetch all messages
		const allMessages = await db
			.select()
			.from(messages)
			.where(eq(messages.conversationId, conversation.id))
			.orderBy(messages.createdAt);

		return json({ messages: allMessages });
	} catch (error) {
		console.error('Failed to send message:', error);
		return json({ error: 'Failed to send message' }, { status: 500 });
	}
};
