import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages, characters, llmSettings } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateImpersonation } from '$lib/server/llm';

// POST - Generate a message as the user (impersonation)
// Returns the generated text for the user to review before sending
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

		// Generate impersonation response (AI writes as user)
		const impersonatedMessage = await generateImpersonation(
			conversationHistory,
			character,
			settings
		);

		// Return the generated text for the user to review
		return json({ content: impersonatedMessage });
	} catch (error) {
		console.error('Failed to generate impersonation:', error);
		return json({ error: 'Failed to generate impersonation' }, { status: 500 });
	}
};
