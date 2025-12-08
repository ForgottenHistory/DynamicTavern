import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sdSettingsService } from '$lib/server/services/sdSettingsService';

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const userId = cookies.get('userId');

		if (!userId) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}

		const settings = await sdSettingsService.getUserSettings(parseInt(userId));

		return json({ settings });
	} catch (error: any) {
		console.error('Failed to get SD settings:', error);
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

		const settings = await sdSettingsService.updateUserSettings(parseInt(userId), body);

		return json({ settings, message: 'Settings updated successfully' });
	} catch (error: any) {
		console.error('Failed to update SD settings:', error);
		return json({ error: 'Failed to update settings' }, { status: 500 });
	}
};
