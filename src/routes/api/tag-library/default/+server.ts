import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { promises as fs } from 'fs';
import path from 'path';

export const GET: RequestHandler = async () => {
	try {
		const defaultTagsPath = path.join(process.cwd(), 'src', 'lib', 'assets', 'default_tags.txt');
		const content = await fs.readFile(defaultTagsPath, 'utf-8');
		return json({ content });
	} catch (error) {
		console.error('Error fetching default tags:', error);
		return json({ error: 'Failed to fetch default tags' }, { status: 500 });
	}
};
