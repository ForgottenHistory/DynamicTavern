import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { llmPresets } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// GET - Fetch all LLM presets for user
export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const presets = await db
			.select()
			.from(llmPresets)
			.where(eq(llmPresets.userId, parseInt(userId)))
			.orderBy(llmPresets.createdAt);

		return json({ presets });
	} catch (error) {
		console.error('Failed to fetch LLM presets:', error);
		return json({ error: 'Failed to fetch presets' }, { status: 500 });
	}
};

// POST - Create new LLM preset
export const POST: RequestHandler = async ({ request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const {
			name,
			provider,
			model,
			temperature,
			maxTokens,
			topP,
			frequencyPenalty,
			presencePenalty,
			contextWindow,
			reasoningEnabled
		} = await request.json();

		if (!name) {
			return json({ error: 'Preset name is required' }, { status: 400 });
		}

		const userIdNum = parseInt(userId);

		// Check if preset with same name exists for this user
		const existing = await db
			.select()
			.from(llmPresets)
			.where(and(eq(llmPresets.userId, userIdNum), eq(llmPresets.name, name)))
			.limit(1);

		let preset;
		if (existing[0]) {
			// Update existing preset
			const [updated] = await db
				.update(llmPresets)
				.set({
					provider,
					model,
					temperature,
					maxTokens,
					topP,
					frequencyPenalty,
					presencePenalty,
					contextWindow,
					reasoningEnabled: reasoningEnabled ?? false
				})
				.where(eq(llmPresets.id, existing[0].id))
				.returning();
			preset = updated;
		} else {
			// Create new preset
			const [created] = await db
				.insert(llmPresets)
				.values({
					userId: userIdNum,
					name,
					provider,
					model,
					temperature,
					maxTokens,
					topP,
					frequencyPenalty,
					presencePenalty,
					contextWindow,
					reasoningEnabled: reasoningEnabled ?? false
				})
				.returning();
			preset = created;
		}

		return json({ preset }, { status: 201 });
	} catch (error) {
		console.error('Failed to create LLM preset:', error);
		return json({ error: 'Failed to create preset' }, { status: 500 });
	}
};
