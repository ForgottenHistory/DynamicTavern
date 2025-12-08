import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import axios from 'axios';
import { OPENROUTER_API_KEY, FEATHERLESS_API_KEY } from '$env/static/private';

export const GET: RequestHandler = async ({ url }) => {
	const provider = url.searchParams.get('provider') || 'openrouter';

	try {
		if (provider === 'featherless') {
			// Fetch models from Featherless
			const response = await axios.get('https://api.featherless.ai/v1/models', {
				headers: {
					Authorization: `Bearer ${FEATHERLESS_API_KEY}`
				}
			});

			// Transform to simpler format and deduplicate by ID
			const seenIds = new Set<string>();
			const models = response.data.data
				.filter((model: any) => {
					if (seenIds.has(model.id)) {
						return false;
					}
					seenIds.add(model.id);
					return true;
				})
				.map((model: any) => ({
					id: model.id,
					name: model.id.split('/').pop() || model.id,
					description: model.id,
					contextLength: model.context_length || 4096,
					pricing: null
				}));

			return json({ models });
		} else {
			// Fetch models from OpenRouter
			const response = await axios.get('https://openrouter.ai/api/v1/models', {
				headers: {
					Authorization: `Bearer ${OPENROUTER_API_KEY}`
				}
			});

			// Transform to simpler format
			const models = response.data.data.map((model: any) => ({
				id: model.id,
				name: model.name,
				description: model.description || '',
				contextLength: model.context_length,
				pricing: model.pricing
			}));

			return json({ models });
		}
	} catch (error: any) {
		console.error('Failed to fetch models:', error);
		return json(
			{
				error: 'Failed to fetch models',
				models: []
			},
			{ status: 500 }
		);
	}
};
