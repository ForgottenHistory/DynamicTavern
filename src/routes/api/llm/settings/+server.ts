import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { llmSettingsFileService } from '$lib/server/services/llmSettingsFileService';

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const userId = cookies.get('userId');

		if (!userId) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}

		const settings = llmSettingsFileService.getSettings('chat');

		return json({ settings });
	} catch (error: any) {
		console.error('Failed to get LLM settings:', error);
		return json({ error: 'Failed to get settings' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const userId = cookies.get('userId');

		if (!userId) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}

		const body = await request.json();

		const settings = llmSettingsFileService.updateSettings('chat', body);

		return json({ settings, message: 'Settings updated successfully' });
	} catch (error: any) {
		console.error('Failed to update LLM settings:', error);
		return json({ error: 'Failed to update settings' }, { status: 500 });
	}
};
