import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages, characters } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// POST - Reset conversation (delete all messages and re-add first_mes)
export const POST: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const conversationId = parseInt(params.conversationId);
	if (isNaN(conversationId)) {
		return json({ error: 'Invalid conversation ID' }, { status: 400 });
	}

	try {
		// Verify conversation belongs to user
		const [conversation] = await db
			.select()
			.from(conversations)
			.where(and(eq(conversations.id, conversationId), eq(conversations.userId, parseInt(userId))))
			.limit(1);

		if (!conversation) {
			return json({ error: 'Conversation not found' }, { status: 404 });
		}

		// Delete all messages in the conversation
		await db.delete(messages).where(eq(messages.conversationId, conversationId));

		// Get character card to re-add first_mes
		const [character] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, conversation.characterId))
			.limit(1);

		if (character && character.cardData) {
			try {
				const cardData = JSON.parse(character.cardData);
				const firstMessage = cardData.data?.first_mes || cardData.first_mes;
				const alternateGreetings = cardData.data?.alternate_greetings || cardData.alternate_greetings || [];

				// Add first_mes as initial assistant message if it exists
				if (firstMessage && firstMessage.trim()) {
					// Build swipes array with first_mes and alternate_greetings
					const swipes = [firstMessage.trim(), ...alternateGreetings.filter((g: string) => g && g.trim())];

					await db.insert(messages).values({
						conversationId: conversationId,
						role: 'assistant',
						content: firstMessage.trim(),
						swipes: swipes.length > 1 ? JSON.stringify(swipes) : null,
						currentSwipe: 0,
						senderName: character.name,
						senderAvatar: character.thumbnailData || character.imageData
					});
				}
			} catch (parseError) {
				console.error('Failed to parse character card data:', parseError);
			}
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to reset conversation:', error);
		return json({ error: 'Failed to reset conversation' }, { status: 500 });
	}
};
