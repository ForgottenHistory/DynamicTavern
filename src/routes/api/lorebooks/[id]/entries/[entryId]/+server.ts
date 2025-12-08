import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { lorebooks, lorebookEntries } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// PUT - Update entry
export const PUT: RequestHandler = async ({ params, request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const lorebookId = parseInt(params.id!);
	const entryId = parseInt(params.entryId!);
	if (isNaN(lorebookId) || isNaN(entryId)) {
		return json({ error: 'Invalid ID' }, { status: 400 });
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

		const updateData: Record<string, unknown> = {};
		if (name !== undefined) updateData.name = name;
		if (keywords !== undefined) updateData.keywords = JSON.stringify(keywords);
		if (content !== undefined) updateData.content = content;
		if (enabled !== undefined) updateData.enabled = enabled;
		if (caseSensitive !== undefined) updateData.caseSensitive = caseSensitive;
		if (priority !== undefined) updateData.priority = priority;

		const [updated] = await db
			.update(lorebookEntries)
			.set(updateData)
			.where(and(eq(lorebookEntries.id, entryId), eq(lorebookEntries.lorebookId, lorebookId)))
			.returning();

		if (!updated) {
			return json({ error: 'Entry not found' }, { status: 404 });
		}

		return json({
			entry: {
				...updated,
				keywords: JSON.parse(updated.keywords)
			}
		});
	} catch (error) {
		console.error('Failed to update entry:', error);
		return json({ error: 'Failed to update entry' }, { status: 500 });
	}
};

// DELETE - Delete entry
export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const lorebookId = parseInt(params.id!);
	const entryId = parseInt(params.entryId!);
	if (isNaN(lorebookId) || isNaN(entryId)) {
		return json({ error: 'Invalid ID' }, { status: 400 });
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

		const result = await db
			.delete(lorebookEntries)
			.where(and(eq(lorebookEntries.id, entryId), eq(lorebookEntries.lorebookId, lorebookId)));

		if (result.changes === 0) {
			return json({ error: 'Entry not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete entry:', error);
		return json({ error: 'Failed to delete entry' }, { status: 500 });
	}
};
