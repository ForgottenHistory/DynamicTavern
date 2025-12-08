import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { llmPresets } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// DELETE - Delete LLM preset
export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const presetId = parseInt(params.id);
	if (isNaN(presetId)) {
		return json({ error: 'Invalid preset ID' }, { status: 400 });
	}

	try {
		// Verify ownership
		const [existing] = await db
			.select()
			.from(llmPresets)
			.where(and(eq(llmPresets.id, presetId), eq(llmPresets.userId, parseInt(userId))))
			.limit(1);

		if (!existing) {
			return json({ error: 'Preset not found' }, { status: 404 });
		}

		await db.delete(llmPresets).where(eq(llmPresets.id, presetId));

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete LLM preset:', error);
		return json({ error: 'Failed to delete preset' }, { status: 500 });
	}
};
