import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { characters, conversations } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { clothesGenerationService } from '$lib/server/services/clothesGenerationService';
import { personaService } from '$lib/server/services/personaService';
import { worldInfoService } from '$lib/server/services/worldInfoService';

// GET - Get saved clothes for a conversation
export const GET: RequestHandler = async ({ params, cookies, url }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.characterId!);
	if (isNaN(characterId)) {
		return json({ error: 'Invalid character ID' }, { status: 400 });
	}

	try {
		// Get active conversation for this character
		const [conversation] = await db
			.select()
			.from(conversations)
			.where(
				and(
					eq(conversations.primaryCharacterId, characterId),
					eq(conversations.userId, parseInt(userId)),
					eq(conversations.isActive, true)
				)
			)
			.limit(1);

		if (!conversation) {
			return json({ error: 'No active conversation' }, { status: 404 });
		}

		const clothes = await worldInfoService.getClothes(conversation.id);
		return json(clothes);
	} catch (error) {
		console.error('Failed to get clothes:', error);
		return json({ error: 'Failed to get clothes' }, { status: 500 });
	}
};

// POST - Generate clothes for character and user
export const POST: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.characterId!);
	if (isNaN(characterId)) {
		return json({ error: 'Invalid character ID' }, { status: 400 });
	}

	try {
		// Get character
		const [character] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, characterId))
			.limit(1);

		if (!character) {
			return json({ error: 'Character not found' }, { status: 404 });
		}

		// Get active conversation for this character
		const [conversation] = await db
			.select()
			.from(conversations)
			.where(
				and(
					eq(conversations.primaryCharacterId, characterId),
					eq(conversations.userId, parseInt(userId)),
					eq(conversations.isActive, true)
				)
			)
			.limit(1);

		if (!conversation) {
			return json({ error: 'No active conversation' }, { status: 404 });
		}

		// Parse character card data for scenario
		let characterData: any = {};
		try {
			characterData = JSON.parse(character.cardData);
			if (characterData.data) {
				characterData = characterData.data;
			}
		} catch (error) {
			console.error('Failed to parse character card data:', error);
		}

		// Get user info
		const userInfo = await personaService.getActiveUserInfo(parseInt(userId));

		// Generate clothes
		const clothes = await clothesGenerationService.generateClothes({
			characterName: character.name,
			characterDescription: character.description || characterData.description || '',
			scenario: characterData.scenario || '',
			userName: userInfo.name
		});

		// Save to database
		await worldInfoService.updateClothes(conversation.id, clothes);

		return json(clothes);
	} catch (error) {
		console.error('Failed to generate clothes:', error);
		return json({ error: 'Failed to generate clothes' }, { status: 500 });
	}
};
