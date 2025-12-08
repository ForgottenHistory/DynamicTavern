import { error, type RequestHandler } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';

const IMAGES_DIR = 'data/images';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		throw error(401, 'Not authenticated');
	}

	const filename = params.filename;
	if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
		throw error(400, 'Invalid filename');
	}

	const filepath = path.join(IMAGES_DIR, filename);

	try {
		const imageBuffer = await fs.readFile(filepath);

		return new Response(imageBuffer, {
			headers: {
				'Content-Type': 'image/png',
				'Cache-Control': 'public, max-age=31536000'
			}
		});
	} catch (err) {
		throw error(404, 'Image not found');
	}
};
