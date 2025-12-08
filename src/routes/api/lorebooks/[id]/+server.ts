import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { lorebooks, lorebookEntries } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// GET - Fetch single lorebook with all entries
export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const lorebookId = parseInt(params.id!);
	if (isNaN(lorebookId)) {
		return json({ error: 'Invalid lorebook ID' }, { status: 400 });
	}

	try {
		const [lorebook] = await db
			.select()
			.from(lorebooks)
			.where(and(eq(lorebooks.id, lorebookId), eq(lorebooks.userId, parseInt(userId))))
			.limit(1);

		if (!lorebook) {
			return json({ error: 'Lorebook not found' }, { status: 404 });
		}

		const entries = await db
			.select()
			.from(lorebookEntries)
			.where(eq(lorebookEntries.lorebookId, lorebookId))
			.orderBy(lorebookEntries.priority);

		// Parse keywords JSON for each entry
		const parsedEntries = entries.map((entry) => ({
			...entry,
			keywords: JSON.parse(entry.keywords)
		}));

		return json({ lorebook, entries: parsedEntries });
	} catch (error) {
		console.error('Failed to fetch lorebook:', error);
		return json({ error: 'Failed to fetch lorebook' }, { status: 500 });
	}
};

// PUT - Update lorebook
export const PUT: RequestHandler = async ({ params, request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const lorebookId = parseInt(params.id!);
	if (isNaN(lorebookId)) {
		return json({ error: 'Invalid lorebook ID' }, { status: 400 });
	}

	try {
		const { name, description, isGlobal, enabled } = await request.json();

		const [updated] = await db
			.update(lorebooks)
			.set({
				name,
				description,
				isGlobal,
				enabled
			})
			.where(and(eq(lorebooks.id, lorebookId), eq(lorebooks.userId, parseInt(userId))))
			.returning();

		if (!updated) {
			return json({ error: 'Lorebook not found' }, { status: 404 });
		}

		return json({ lorebook: updated });
	} catch (error) {
		console.error('Failed to update lorebook:', error);
		return json({ error: 'Failed to update lorebook' }, { status: 500 });
	}
};

// DELETE - Delete lorebook and all its entries
export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const lorebookId = parseInt(params.id!);
	if (isNaN(lorebookId)) {
		return json({ error: 'Invalid lorebook ID' }, { status: 400 });
	}

	try {
		const result = await db
			.delete(lorebooks)
			.where(and(eq(lorebooks.id, lorebookId), eq(lorebooks.userId, parseInt(userId))));

		if (result.changes === 0) {
			return json({ error: 'Lorebook not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete lorebook:', error);
		return json({ error: 'Failed to delete lorebook' }, { status: 500 });
	}
};
