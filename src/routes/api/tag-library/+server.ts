import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = 'data';

function getTagLibraryPath(userId: string): string {
	return path.join(DATA_DIR, `tags_${userId}.txt`);
}

async function ensureDataDir(): Promise<void> {
	try {
		await fs.access(DATA_DIR);
	} catch {
		await fs.mkdir(DATA_DIR, { recursive: true });
	}
}

export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');

	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		await ensureDataDir();
		const filePath = getTagLibraryPath(userId);

		let content = '';
		let updatedAt: Date | null = null;

		try {
			content = await fs.readFile(filePath, 'utf-8');
			const stats = await fs.stat(filePath);
			updatedAt = stats.mtime;
		} catch {
			// File doesn't exist yet, return empty content
		}

		return json({ content, updatedAt });
	} catch (error) {
		console.error('Error fetching tag library:', error);
		return json({ error: 'Failed to fetch tag library' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request, cookies }) => {
	const userId = cookies.get('userId');

	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { content } = await request.json();

		if (typeof content !== 'string') {
			return json({ error: 'Invalid content' }, { status: 400 });
		}

		await ensureDataDir();
		const filePath = getTagLibraryPath(userId);

		await fs.writeFile(filePath, content, 'utf-8');
		const stats = await fs.stat(filePath);

		return json({ content, updatedAt: stats.mtime });
	} catch (error) {
		console.error('Error updating tag library:', error);
		return json({ error: 'Failed to update tag library' }, { status: 500 });
	}
};
