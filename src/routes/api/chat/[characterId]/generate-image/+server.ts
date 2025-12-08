import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages, characters } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { imageTagGenerationService } from '$lib/server/services/imageTagGenerationService';

// POST - Generate image tags from conversation context
export const POST: RequestHandler = async ({ params, cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.characterId!);
	if (isNaN(characterId)) {
		return json({ error: 'Invalid character ID' }, { status: 400 });
	}

	try {
		const { type = 'all' } = await request.json();

		// Validate type
		if (!['all', 'character', 'user', 'scene'].includes(type)) {
			return json({ error: 'Invalid type. Must be: all, character, user, or scene' }, { status: 400 });
		}

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

		// Get recent conversation history (last 10 messages for context)
		const conversationHistory = await db
			.select()
			.from(messages)
			.where(eq(messages.conversationId, conversation.id))
			.orderBy(desc(messages.createdAt))
			.limit(10);

		// Reverse to get chronological order
		conversationHistory.reverse();

		// Build conversation context string
		const conversationContext = conversationHistory
			.map(m => `${m.role === 'user' ? 'User' : character.name}: ${m.content}`)
			.join('\n\n');

		// Generate tags
		const result = await imageTagGenerationService.generateTags({
			userId: parseInt(userId),
			conversationContext,
			characterName: character.name,
			imageTags: character.imageTags || '',
			contextualTags: character.contextualTags || '',
			type: type as 'all' | 'character' | 'user' | 'scene'
		});

		return json({
			tags: result.generatedTags,
			alwaysTags: result.alwaysTags,
			breakdown: result.breakdown,
			type
		});
	} catch (error) {
		console.error('Failed to generate image tags:', error);
		return json({ error: 'Failed to generate image tags' }, { status: 500 });
	}
};
