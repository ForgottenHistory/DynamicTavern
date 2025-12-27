import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getUserById } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { characters } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ cookies }) => {
	const userId = cookies.get('userId');

	if (!userId) {
		throw redirect(302, '/login');
	}

	const user = await getUserById(parseInt(userId));

	if (!user) {
		cookies.delete('userId', { path: '/' });
		throw redirect(302, '/login');
	}

	// Load all characters for the user
	const userCharacters = await db
		.select({
			id: characters.id,
			name: characters.name,
			description: characters.description,
			thumbnailData: characters.thumbnailData,
			imageData: characters.imageData
		})
		.from(characters)
		.where(eq(characters.userId, parseInt(userId)));

	return {
		user,
		characters: userCharacters
	};
};
