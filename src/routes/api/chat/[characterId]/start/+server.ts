import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages, characters } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { scenarioService } from '$lib/server/services/scenarioService';
import { contentLlmService } from '$lib/server/services/contentLlmService';
import { personaService } from '$lib/server/services/personaService';
import { sceneService } from '$lib/server/services/sceneService';
import { generateSceneNarration } from '$lib/server/llm';

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
		const { scenarioId, useStandardGreeting, additionalCharacterIds } = body;

		// Get primary character
		const [character] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, characterId))
			.limit(1);

		if (!character) {
			return json({ error: 'Character not found' }, { status: 404 });
		}

		// Get additional characters if specified
		let additionalCharacters: typeof character[] = [];
		if (additionalCharacterIds && additionalCharacterIds.length > 0) {
			additionalCharacters = await db
				.select()
				.from(characters)
				.where(
					and(
						inArray(characters.id, additionalCharacterIds),
						eq(characters.userId, parseInt(userId))
					)
				);
		}

		const allCharacters = [character, ...additionalCharacters];

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

		let scenarioContent: string | null = null;

		if (scenarioId) {
			// Get scenario content
			const scenario = await scenarioService.get(scenarioId);
			if (!scenario) {
				return json({ error: 'Scenario not found' }, { status: 404 });
			}

			// Get user info for the scenario
			const userInfo = await personaService.getActiveUserInfo(parseInt(userId));

			// Apply variables to scenario content
			scenarioContent = scenarioService.applyVariables(scenario.content, {
				char: character.name,
				user: userInfo.name
			});
		}

		// Create new conversation
		const [conversation] = await db
			.insert(conversations)
			.values({
				userId: parseInt(userId),
				characterId, // Legacy field for backwards compatibility
				primaryCharacterId: characterId,
				isActive: true,
				scenario: scenarioContent
			})
			.returning();

		// Add all characters as scene participants
		for (const char of allCharacters) {
			await sceneService.addCharacterToScene(conversation.id, char.id);
		}

		// Generate narrator scene intro
		const narratorContent = await generateSceneNarration(
			parseInt(userId),
			conversation.id,
			'scene_intro',
			{ characterNames: allCharacters.map((c) => c.name) }
		);

		// Insert narrator intro message
		await db.insert(messages).values({
			conversationId: conversation.id,
			role: 'narrator',
			content: narratorContent.content,
			senderName: 'Narrator',
			reasoning: narratorContent.reasoning
		});

		// Insert character greeting(s)
		if (useStandardGreeting) {
			// Use standard first_mes from primary character card
			const greetingContent = data.first_mes;
			if (greetingContent && greetingContent.trim()) {
				const alternateGreetings = data.alternate_greetings || [];
				const allGreetings = [greetingContent.trim(), ...alternateGreetings.filter((g: string) => g && g.trim())];
				const swipes = allGreetings.length > 1 ? allGreetings : null;

				await db.insert(messages).values({
					conversationId: conversation.id,
					role: 'assistant',
					characterId: character.id,
					content: greetingContent.trim(),
					swipes: swipes ? JSON.stringify(swipes) : null,
					currentSwipe: 0,
					senderName: character.name,
					senderAvatar: character.thumbnailData || character.imageData
				});
			}
		} else if (scenarioId) {
			// Generate custom greeting using Content LLM
			const userInfo = await personaService.getActiveUserInfo(parseInt(userId));
			const greetingContent = await contentLlmService.generateScenarioGreeting({
				characterName: character.name,
				characterDescription: character.description || data.description || '',
				characterPersonality: data.personality || '',
				scenario: scenarioContent || '',
				userName: userInfo.name
			});

			if (greetingContent && greetingContent.trim()) {
				await db.insert(messages).values({
					conversationId: conversation.id,
					role: 'assistant',
					characterId: character.id,
					content: greetingContent.trim(),
					senderName: character.name,
					senderAvatar: character.thumbnailData || character.imageData
				});
			}
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
