import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { lorebooks, lorebookEntries } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// GET - Fetch all lorebooks for user with entry counts
export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const userLorebooks = await db
			.select()
			.from(lorebooks)
			.where(eq(lorebooks.userId, parseInt(userId)))
			.orderBy(lorebooks.createdAt);

		// Get entry counts for each lorebook
		const lorebooksWithCounts = await Promise.all(
			userLorebooks.map(async (lorebook) => {
				const entries = await db
					.select()
					.from(lorebookEntries)
					.where(eq(lorebookEntries.lorebookId, lorebook.id));
				return {
					...lorebook,
					entryCount: entries.length,
					enabledCount: entries.filter((e) => e.enabled).length
				};
			})
		);

		return json({ lorebooks: lorebooksWithCounts });
	} catch (error) {
		console.error('Failed to fetch lorebooks:', error);
		return json({ error: 'Failed to fetch lorebooks' }, { status: 500 });
	}
};

// POST - Create new lorebook
export const POST: RequestHandler = async ({ request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const { name, description, isGlobal } = await request.json();

		if (!name) {
			return json({ error: 'Lorebook name is required' }, { status: 400 });
		}

		const [lorebook] = await db
			.insert(lorebooks)
			.values({
				userId: parseInt(userId),
				name,
				description: description || null,
				isGlobal: isGlobal || false
			})
			.returning();

		return json({ lorebook: { ...lorebook, entryCount: 0, enabledCount: 0 } }, { status: 201 });
	} catch (error) {
		console.error('Failed to create lorebook:', error);
		return json({ error: 'Failed to create lorebook' }, { status: 500 });
	}
};
