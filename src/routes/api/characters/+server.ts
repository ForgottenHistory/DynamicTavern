import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { characters } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const userId = cookies.get('userId');

		if (!userId) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}

		const userCharacters = await db
			.select()
			.from(characters)
			.where(eq(characters.userId, parseInt(userId)));

		return json({ characters: userCharacters });
	} catch (error: any) {
		console.error('Failed to get characters:', error);
		return json({ error: 'Failed to get characters' }, { status: 500 });
	}
};
