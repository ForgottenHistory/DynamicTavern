import { json, type RequestHandler } from '@sveltejs/kit';
import { llmSettingsFileService } from '$lib/server/services/llmSettingsFileService';

// DELETE - Delete LLM preset
export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const presetId = params.id;
	if (!presetId) {
		return json({ error: 'Invalid preset ID' }, { status: 400 });
	}

	try {
		const deleted = llmSettingsFileService.deletePreset(presetId);

		if (!deleted) {
			return json({ error: 'Preset not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete LLM preset:', error);
		return json({ error: 'Failed to delete preset' }, { status: 500 });
	}
};
