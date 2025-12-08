import { json, type RequestHandler } from '@sveltejs/kit';
import { llmSettingsFileService } from '$lib/server/services/llmSettingsFileService';

// GET - Fetch all LLM presets
export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const presets = llmSettingsFileService.getAllPresets();
		return json({ presets });
	} catch (error) {
		console.error('Failed to fetch LLM presets:', error);
		return json({ error: 'Failed to fetch presets' }, { status: 500 });
	}
};

// POST - Create or update LLM preset
export const POST: RequestHandler = async ({ request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const body = await request.json();

		if (!body.name) {
			return json({ error: 'Preset name is required' }, { status: 400 });
		}

		const preset = llmSettingsFileService.savePreset(body);

		return json({ preset }, { status: 201 });
	} catch (error) {
		console.error('Failed to create LLM preset:', error);
		return json({ error: 'Failed to create preset' }, { status: 500 });
	}
};
