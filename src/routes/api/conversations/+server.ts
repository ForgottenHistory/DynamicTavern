import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages, characters } from '$lib/server/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

// GET - List all conversations for the user
export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		// Get all active conversations with their primary character info
		const userConversations = await db
			.select({
				id: conversations.id,
				characterId: conversations.characterId,
				primaryCharacterId: conversations.primaryCharacterId,
				name: conversations.name,
				scenario: conversations.scenario,
				createdAt: conversations.createdAt,
				isActive: conversations.isActive
			})
			.from(conversations)
			.where(
				and(
					eq(conversations.userId, parseInt(userId)),
					eq(conversations.isActive, true)
				)
			)
			.orderBy(desc(conversations.createdAt));

		// Enrich with character data and last message
		const enrichedConversations = await Promise.all(
			userConversations.map(async (conv) => {
				const charId = conv.primaryCharacterId || conv.characterId;

				// Get character info
				let character = null;
				if (charId) {
					const [char] = await db
						.select({
							id: characters.id,
							name: characters.name,
							thumbnailData: characters.thumbnailData,
							imageData: characters.imageData
						})
						.from(characters)
						.where(eq(characters.id, charId))
						.limit(1);
					character = char || null;
				}

				// Get last message for preview
				const [lastMessage] = await db
					.select({
						content: messages.content,
						role: messages.role,
						createdAt: messages.createdAt
					})
					.from(messages)
					.where(eq(messages.conversationId, conv.id))
					.orderBy(desc(messages.createdAt))
					.limit(1);

				// Get message count
				const [countResult] = await db
					.select({ count: sql<number>`count(*)` })
					.from(messages)
					.where(eq(messages.conversationId, conv.id));

				return {
					...conv,
					character,
					lastMessage: lastMessage || null,
					messageCount: countResult?.count || 0
				};
			})
		);

		return json({ conversations: enrichedConversations });
	} catch (error) {
		console.error('Failed to list conversations:', error);
		return json({ error: 'Failed to list conversations' }, { status: 500 });
	}
};
