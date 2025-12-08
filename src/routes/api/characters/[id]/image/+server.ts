import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { characters } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const PUT: RequestHandler = async ({ params, request, cookies }) => {
	const userId = cookies.get('userId');

	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const characterId = parseInt(params.id);
		const { imageData } = await request.json();

		if (!imageData || typeof imageData !== 'string') {
			return json({ error: 'Invalid image data' }, { status: 400 });
		}

		// Update character image
		await db
			.update(characters)
			.set({ imageData })
			.where(eq(characters.id, characterId));

		return json({ success: true });
	} catch (error) {
		console.error('Error updating character image:', error);
		return json({ error: 'Failed to update character image' }, { status: 500 });
	}
};
