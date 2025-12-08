import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { llmService } from '$lib/server/services/llmService';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { prompt } = await request.json();

		if (!prompt) {
			return json({ error: 'Prompt is required' }, { status: 400 });
		}

		// Get userId from session if logged in
		const userId = cookies.get('userId');
		const userIdNum = userId ? parseInt(userId) : undefined;

		console.log('🧪 Testing LLM with prompt:', prompt);

		// Test simple completion
		const response = await llmService.createSimpleCompletion(prompt, userIdNum);

		return json({
			success: true,
			response,
			message: 'LLM test successful!'
		});
	} catch (error: any) {
		console.error('❌ LLM test failed:', error);
		return json(
			{
				error: error.message || 'LLM request failed'
			},
			{ status: 500 }
		);
	}
};
