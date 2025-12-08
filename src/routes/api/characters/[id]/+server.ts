import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { characters } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// GET - Get single character
export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.id);
	if (isNaN(characterId)) {
		return json({ error: 'Invalid character ID' }, { status: 400 });
	}

	try {
		const [character] = await db
			.select()
			.from(characters)
			.where(and(eq(characters.id, characterId), eq(characters.userId, parseInt(userId))))
			.limit(1);

		if (!character) {
			return json({ error: 'Character not found' }, { status: 404 });
		}

		return json({ character });
	} catch (error) {
		console.error('Failed to fetch character:', error);
		return json({ error: 'Failed to fetch character' }, { status: 500 });
	}
};

// PUT - Update character details (name, tags)
export const PUT: RequestHandler = async ({ params, cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.id);
	if (isNaN(characterId)) {
		return json({ error: 'Invalid character ID' }, { status: 400 });
	}

	try {
		const body = await request.json();
		const { name, tags, description, cardData, imageTags, contextualTags, mainPromptOverride, negativePromptOverride } = body;

		// Build update object with only provided fields
		const updateData: Record<string, any> = {};
		if (name !== undefined) updateData.name = name;
		if (tags !== undefined) updateData.tags = JSON.stringify(tags);
		if (description !== undefined) updateData.description = description;
		if (cardData !== undefined) updateData.cardData = JSON.stringify(cardData);
		// Image generation settings
		if (imageTags !== undefined) updateData.imageTags = imageTags;
		if (contextualTags !== undefined) updateData.contextualTags = contextualTags;
		if (mainPromptOverride !== undefined) updateData.mainPromptOverride = mainPromptOverride;
		if (negativePromptOverride !== undefined) updateData.negativePromptOverride = negativePromptOverride;

		if (Object.keys(updateData).length === 0) {
			return json({ error: 'No fields to update' }, { status: 400 });
		}

		// Update only if it belongs to the user
		await db
			.update(characters)
			.set(updateData)
			.where(and(eq(characters.id, characterId), eq(characters.userId, parseInt(userId))));

		return json({ success: true });
	} catch (error) {
		console.error('Failed to update character:', error);
		return json({ error: 'Failed to update character' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	try {
		const userId = cookies.get('userId');

		if (!userId) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}

		const characterId = parseInt(params.id);

		// Delete only if it belongs to the user
		await db
			.delete(characters)
			.where(and(eq(characters.id, characterId), eq(characters.userId, parseInt(userId))));

		return json({ success: true });
	} catch (error: any) {
		console.error('Failed to delete character:', error);
		return json({ error: 'Failed to delete character' }, { status: 500 });
	}
};
