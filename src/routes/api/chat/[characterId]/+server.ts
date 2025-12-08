import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages, characters } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// GET - Get or create conversation and fetch messages
export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.characterId!);
	if (isNaN(characterId)) {
		return json({ error: 'Invalid character ID' }, { status: 400 });
	}

	try {
		// Find active conversation for this character
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

		// If no active conversation, try to find any conversation and make it active
		if (!conversation) {
			[conversation] = await db
				.select()
				.from(conversations)
				.where(
					and(
						eq(conversations.userId, parseInt(userId)),
						eq(conversations.characterId, characterId)
					)
				)
				.limit(1);

			if (conversation) {
				await db
					.update(conversations)
					.set({ isActive: true })
					.where(eq(conversations.id, conversation.id));
			}
		}

		// Create conversation if it doesn't exist
		if (!conversation) {
			[conversation] = await db
				.insert(conversations)
				.values({
					userId: parseInt(userId),
					characterId
				})
				.returning();

			// Get character card to fetch first_mes
			const [character] = await db
				.select()
				.from(characters)
				.where(eq(characters.id, characterId))
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
							conversationId: conversation.id,
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
		}

		// Fetch messages for this conversation
		const conversationMessages = await db
			.select()
			.from(messages)
			.where(eq(messages.conversationId, conversation.id))
			.orderBy(messages.createdAt);

		// Get all branches for this character
		const allBranches = await db
			.select()
			.from(conversations)
			.where(
				and(
					eq(conversations.userId, parseInt(userId)),
					eq(conversations.characterId, characterId)
				)
			)
			.orderBy(desc(conversations.createdAt));

		return json({
			conversationId: conversation.id,
			conversationName: conversation.name,
			messages: conversationMessages,
			branches: allBranches,
			activeBranchId: conversation.id
		});
	} catch (error) {
		console.error('Failed to load conversation:', error);
		return json({ error: 'Failed to load conversation' }, { status: 500 });
	}
};
