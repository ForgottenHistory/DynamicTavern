import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { promptPresets } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// GET - Fetch all prompt presets for user
export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const presets = await db
			.select()
			.from(promptPresets)
			.where(eq(promptPresets.userId, parseInt(userId)))
			.orderBy(promptPresets.createdAt);

		// Parse the JSON prompts field for each preset
		const parsedPresets = presets.map(preset => ({
			...preset,
			prompts: JSON.parse(preset.prompts)
		}));

		return json({ presets: parsedPresets });
	} catch (error) {
		console.error('Failed to fetch prompt presets:', error);
		return json({ error: 'Failed to fetch presets' }, { status: 500 });
	}
};

// POST - Create new prompt preset
export const POST: RequestHandler = async ({ request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const { name, prompts } = await request.json();

		if (!name) {
			return json({ error: 'Preset name is required' }, { status: 400 });
		}

		if (!prompts || typeof prompts !== 'object') {
			return json({ error: 'Prompts data is required' }, { status: 400 });
		}

		const userIdNum = parseInt(userId);

		// Check if preset with same name exists for this user
		const existing = await db
			.select()
			.from(promptPresets)
			.where(and(eq(promptPresets.userId, userIdNum), eq(promptPresets.name, name)))
			.limit(1);

		let preset;
		if (existing[0]) {
			// Update existing preset
			const [updated] = await db
				.update(promptPresets)
				.set({
					prompts: JSON.stringify(prompts)
				})
				.where(eq(promptPresets.id, existing[0].id))
				.returning();
			preset = { ...updated, prompts };
		} else {
			// Create new preset
			const [created] = await db
				.insert(promptPresets)
				.values({
					userId: userIdNum,
					name,
					prompts: JSON.stringify(prompts)
				})
				.returning();
			preset = { ...created, prompts };
		}

		return json({ preset }, { status: 201 });
	} catch (error) {
		console.error('Failed to create prompt preset:', error);
		return json({ error: 'Failed to create preset' }, { status: 500 });
	}
};
