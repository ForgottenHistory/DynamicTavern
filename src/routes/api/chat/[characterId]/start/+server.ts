import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages, characters } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { scenarioService } from '$lib/server/services/scenarioService';
import { contentLlmService } from '$lib/server/services/contentLlmService';
import { personaService } from '$lib/server/services/personaService';

// POST - Start a new chat with optional scenario
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
		const { scenarioId, useStandardGreeting } = body;

		// Get character
		const [character] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, characterId))
			.limit(1);

		if (!character) {
			return json({ error: 'Character not found' }, { status: 404 });
		}

		// Parse card data
		const cardData = character.cardData ? JSON.parse(character.cardData) : {};
		const data = cardData.data || cardData;

		// Deactivate any existing conversations for this character
		await db
			.update(conversations)
			.set({ isActive: false })
			.where(
				and(
					eq(conversations.userId, parseInt(userId)),
					eq(conversations.characterId, characterId)
				)
			);

		// Create new conversation
		const [conversation] = await db
			.insert(conversations)
			.values({
				userId: parseInt(userId),
				characterId,
				isActive: true
			})
			.returning();

		let greetingContent: string | null = null;

		if (useStandardGreeting) {
			// Use standard first_mes from character card
			greetingContent = data.first_mes || null;
		} else if (scenarioId) {
			// Generate greeting from scenario
			const scenario = await scenarioService.get(scenarioId);
			if (!scenario) {
				return json({ error: 'Scenario not found' }, { status: 404 });
			}

			// Get user info for the scenario
			const userInfo = await personaService.getActiveUserInfo(parseInt(userId));

			// Apply variables to scenario content
			const scenarioContent = scenarioService.applyVariables(scenario.content, {
				char: character.name,
				user: userInfo.name
			});

			// Generate custom greeting using Content LLM
			greetingContent = await contentLlmService.generateScenarioGreeting({
				characterName: character.name,
				characterDescription: character.description || data.description || '',
				characterPersonality: data.personality || '',
				scenario: scenarioContent,
				userName: userInfo.name
			});
		}

		// Insert greeting message if we have one
		if (greetingContent && greetingContent.trim()) {
			// For standard greeting, include alternate greetings as swipes
			let swipes: string[] | null = null;
			if (useStandardGreeting) {
				const alternateGreetings = data.alternate_greetings || [];
				const allGreetings = [greetingContent.trim(), ...alternateGreetings.filter((g: string) => g && g.trim())];
				swipes = allGreetings.length > 1 ? allGreetings : null;
			}

			await db.insert(messages).values({
				conversationId: conversation.id,
				role: 'assistant',
				content: greetingContent.trim(),
				swipes: swipes ? JSON.stringify(swipes) : null,
				currentSwipe: 0,
				senderName: character.name,
				senderAvatar: character.thumbnailData || character.imageData
			});
		}

		return json({
			success: true,
			conversationId: conversation.id
		});
	} catch (error) {
		console.error('Failed to start chat:', error);
		return json({ error: 'Failed to start chat' }, { status: 500 });
	}
};
