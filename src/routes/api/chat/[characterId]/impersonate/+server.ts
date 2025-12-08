import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages, characters } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateImpersonation } from '$lib/server/llm';
import { llmSettingsService } from '$lib/server/services/llmSettingsService';
import type { ImpersonateStyle } from '$lib/types/chat';

// POST - Generate a message as the user (impersonation)
// Returns the generated text for the user to review before sending
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
		const body = await request.json();
		const style: ImpersonateStyle = body.style || 'impersonate';

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

		// Get LLM settings from file
		const settings = llmSettingsService.getSettings();

		// Generate impersonation response (AI writes as user)
		const impersonatedMessage = await generateImpersonation(
			conversationHistory,
			character,
			settings,
			style,
			parseInt(userId)
		);

		// Return the generated text for the user to review
		return json({ content: impersonatedMessage });
	} catch (error) {
		console.error('Failed to generate impersonation:', error);
		return json({ error: 'Failed to generate impersonation' }, { status: 500 });
	}
};
