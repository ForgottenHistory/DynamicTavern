import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, characters, messages } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { sceneService } from '$lib/server/services/sceneService';
import { generateSceneNarration } from '$lib/server/llm';

// POST - Remove a character from the scene
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

		// Check if in scene
		const inScene = await sceneService.isCharacterInScene(conversationId, character.id);
		if (!inScene) {
			return json({ error: 'Character is not in the scene' }, { status: 400 });
		}

		// Check if this is the only character - don't allow removing the last one
		const activeChars = await sceneService.getActiveCharacters(conversationId);
		if (activeChars.length <= 1) {
			return json({ error: 'Cannot remove the last character from the scene' }, { status: 400 });
		}

		// Generate narrator message for character leaving
		const narratorContent = await generateSceneNarration(
			parseInt(userId),
			conversationId,
			'leave_scene',
			{ characterName: character.name }
		);

		// Remove character from scene
		await sceneService.removeCharacterFromScene(conversationId, character.id);

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
		console.error('Failed to remove character from scene:', error);
		return json({ error: 'Failed to remove character from scene' }, { status: 500 });
	}
};
