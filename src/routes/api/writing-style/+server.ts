import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'fs/promises';
import path from 'path';

const WRITING_STYLE_FILE = path.join(process.cwd(), 'data', 'prompts', 'writing_style.txt');

export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const content = await fs.readFile(WRITING_STYLE_FILE, 'utf-8');
		return json({ content });
	} catch (error) {
		// File doesn't exist yet, return empty
		return json({ content: '' });
	}
};

export const PUT: RequestHandler = async ({ cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { content } = body;

		if (typeof content !== 'string') {
			return json({ error: 'Content must be a string' }, { status: 400 });
		}

		// Ensure directory exists
		const dir = path.dirname(WRITING_STYLE_FILE);
		await fs.mkdir(dir, { recursive: true });

		// Write to file
		await fs.writeFile(WRITING_STYLE_FILE, content, 'utf-8');

		return json({ success: true });
	} catch (error) {
		console.error('Failed to save writing style:', error);
		return json({ error: 'Failed to save writing style' }, { status: 500 });
	}
};
