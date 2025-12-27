import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, characters, messages } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { sceneService } from '$lib/server/services/sceneService';
import { generateSceneNarration } from '$lib/server/llm';

// POST - Add a character to the scene
export const POST: RequestHandler = async ({ params, cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const conversationId = parseInt(params.conversationId!);
	if (isNaN(conversationId)) {
		return json({ error: 'Invalid conversation ID' }, { status: 400 });
	}

	try {
		const body = await request.json();
		const characterId = body.characterId;

		if (!characterId || isNaN(parseInt(characterId))) {
			return json({ error: 'Invalid character ID' }, { status: 400 });
		}

		// Verify conversation belongs to user
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

		// Verify character belongs to user
		const [character] = await db
			.select()
			.from(characters)
			.where(
				and(
					eq(characters.id, parseInt(characterId)),
					eq(characters.userId, parseInt(userId))
				)
			)
			.limit(1);

		if (!character) {
			return json({ error: 'Character not found' }, { status: 404 });
		}

		// Check if already in scene
		const alreadyInScene = await sceneService.isCharacterInScene(conversationId, character.id);
		if (alreadyInScene) {
			return json({ error: 'Character is already in the scene' }, { status: 400 });
		}

		// Add character to scene
		await sceneService.addCharacterToScene(conversationId, character.id);

		// Generate narrator message for character entering
		const narratorContent = await generateSceneNarration(
			parseInt(userId),
			conversationId,
			'enter_scene',
			{ characterName: character.name }
		);

		// Save narrator message
		const [narratorMessage] = await db
			.insert(messages)
			.values({
				conversationId,
				role: 'narrator',
				content: narratorContent.content,
				senderName: 'Narrator',
				reasoning: narratorContent.reasoning
			})
			.returning();

		return json({
			success: true,
			character,
			narratorMessage
		});
	} catch (error) {
		console.error('Failed to add character to scene:', error);
		return json({ error: 'Failed to add character to scene' }, { status: 500 });
	}
};
