import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { lorebooks, lorebookEntries } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// POST - Create new entry in lorebook
export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const lorebookId = parseInt(params.id!);
	if (isNaN(lorebookId)) {
		return json({ error: 'Invalid lorebook ID' }, { status: 400 });
	}

	try {
		// Verify lorebook ownership
		const [lorebook] = await db
			.select()
			.from(lorebooks)
			.where(and(eq(lorebooks.id, lorebookId), eq(lorebooks.userId, parseInt(userId))))
			.limit(1);

		if (!lorebook) {
			return json({ error: 'Lorebook not found' }, { status: 404 });
		}

		const { name, keywords, content, enabled, caseSensitive, priority } = await request.json();

		if (!name) {
			return json({ error: 'Entry name is required' }, { status: 400 });
		}

		if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
			return json({ error: 'At least one keyword is required' }, { status: 400 });
		}

		if (!content) {
			return json({ error: 'Entry content is required' }, { status: 400 });
		}

		const [entry] = await db
			.insert(lorebookEntries)
			.values({
				lorebookId,
				name,
				keywords: JSON.stringify(keywords),
				content,
				enabled: enabled ?? true,
				caseSensitive: caseSensitive ?? false,
				priority: priority ?? 0
			})
			.returning();

		return json(
			{
				entry: {
					...entry,
					keywords
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Failed to create entry:', error);
		return json({ error: 'Failed to create entry' }, { status: 500 });
	}
};
