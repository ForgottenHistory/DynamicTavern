import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({
		hasKey: !!process.env.OPENROUTER_API_KEY,
		keyPrefix: process.env.OPENROUTER_API_KEY?.substring(0, 10) || 'not found'
	});
};
