import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { promptPresets } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// DELETE - Delete a prompt preset
export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const presetId = parseInt(params.id!);
	if (isNaN(presetId)) {
		return json({ error: 'Invalid preset ID' }, { status: 400 });
	}

	try {
		const result = await db
			.delete(promptPresets)
			.where(and(eq(promptPresets.id, presetId), eq(promptPresets.userId, parseInt(userId))));

		if (result.changes === 0) {
			return json({ error: 'Preset not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete prompt preset:', error);
		return json({ error: 'Failed to delete preset' }, { status: 500 });
	}
};
